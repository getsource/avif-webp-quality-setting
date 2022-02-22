const { promisify } = require("util");
const sharp = require("sharp");
const stat = promisify(require("fs").stat);
const exists = promisify(require("fs").exists);
const exec = promisify(require("child_process").exec);
const execFile = promisify(require("child_process").execFile);
const writeFile = promisify(require("fs").writeFile);

const DATA = require("../data/image-quality.json");
const { exit } = require("process");

// TODO: Automated copying of the included samples to the `SAMPLE_PATH`.
// TODO: Allow loading of these paths from environment, command line, or config file.
// TODO: Copy the results back to the git project path.
// TODO: Clean the server of the files for running it again when things complete successfully.
// TODO: Sanitize filenames in results, so that they don't reflect the `WORDPRESS_PATH`.

// `WORDPRESS_PATH` is required, but the rest of the paths can have defaults.
// The default assumption is running with the WordPress Docker Environment.
if ( ! process.env.WORDPRESS_PATH ) {
  console.error("'WORDPRESS_PATH' must be defined.\n");
  process.exit(1);
}

/* Path to location of WordPress Docker Environment / WordPress development checkout:
 * https://github.com/wordpress/wordpress-develop/
 *
 * The script assumes the paths within (like the `src` subdirectory) will match with what is in the above repo.
 */
const WORDPRESS_PATH = process.env.WORDPRESS_PATH;

// Path to where the samples referenced below in `run()` are located.
// This requires write access, because the generated samples go in here as well.
const SAMPLE_PATH = process.env.SAMPLE_PATH || WORDPRESS_PATH + "/src/wp-content/quality-samples";

// Path to above samples, but accessible from the environment running WordPress.
// This is defaulted to the path used in the WordPress Docker Environment.
const REMOTE_SAMPLE_PATH = process.env.REMOTE_SAMPLE_PATH || "/var/www/src/wp-content/quality-samples";

// Options are `Imagick` or `GD`; defaults to Imagick.
// It's not currently supported to run both at once.
const EDITOR_TO_USE = process.env.EDITOR_TO_USE || "Imagick";

/* Local Environment Toggle
 * Allows for generating images using WP-CLI on a local environment directly, skipping running through Docker.
 *
 * Currently, setting `SAMPLE_PATH` and `REMOTE_SAMPLE_PATH` to the same path is also necessary.
 */
const USE_LOCAL = process.env.USE_LOCAL || false;

async function getFilename(input, format, width, quality, extension, remote = false) {
  const path = remote ? REMOTE_SAMPLE_PATH : SAMPLE_PATH;
  const prefix = input
    .replace(`${SAMPLE_PATH}/`, "")
    .replace(/\.\w+$/, "")
    .replace(/\W/g, "-");
  return `${path}/${prefix}-${width}-${format}-${quality}.${extension}`;
}

async function makeImage(input, format, width, quality) {
  const input_remote = input.replace( SAMPLE_PATH, REMOTE_SAMPLE_PATH );

  const filename = await getFilename(input, format, width, quality, format);
  const filename_php = filename + ".php";

  const filename_remote = await getFilename(input, format, width, quality, format, true);
  const filename_php_remote = filename_remote + ".php";

  const default_to_editor = `add_filter( 'wp_image_editors', function ( $editors ) { return array( 'WP_Image_Editor_${EDITOR_TO_USE}' ); } );`;

  // Defaults to Docker, unless USE_LOCAL is set.
  const php_convert_command = USE_LOCAL ? `wp eval-file "${filename_php_remote}"` : `npm run env:cli "eval-file ${filename_php_remote}"`;

  if (!(await imageExists(filename))) {
    const php_to_run = `<?php ${default_to_editor} $image = wp_get_image_editor( '${input_remote}' ); $image->resize( ${width}, null ); add_filter( 'wp_editor_set_quality', function( $quality ) { return ${quality}; }, 10, 1 ); $image->set_quality( ${quality} ); $image->save( '${filename_remote}' );`;


    await writeFile( filename_php, php_to_run );
    await exec( php_convert_command,  {
      cwd: WORDPRESS_PATH,
    });
  }
  if (format == "png") {
    return {
      filename,
      png: filename,
    };
  }
  const png = await getFilename(input, format, width, quality, "png");
  if (!(await imageExists(png))) {
    await sharp(filename).png().toFile(png);
  }
  return {
    filename,
    png,
  };
}

async function imageExists(filename) {
  if (!(await exists(filename))) {
    return false;
  }
  const stats = await stat(filename);
  if (stats.size == 0) {
    return false;
  }
  return true;
}

async function getImageData(input, referenceFile, format, width, quality) {
  const image = await makeImage(input, format, width, quality);
  const stats = await stat(image.filename);
  const dssim = parseFloat(
    (await execFile("dssim", [referenceFile, image.png])).stdout.split(/\t/)[0]
  );
  return {
    size: stats.size,
    dssim,
  };
}

function print(input, format, width, quality, info) {
  const data = [format, width, quality, info.size, info.dssim, input];
  console.log(data.join("\t"));
}

async function testImage(filename) {
  DATA[filename] = DATA[filename] || {};
  for (let width of [160, 320, 640, 1280, 1920]) {
    DATA[filename][width] = DATA[filename][width] || {};
    const referenceFile = (await makeImage(filename, "png", width, 100))
      .filename;
    const promises = [];
    for (let format of ["webp", "jpeg"]) { // removed , "avif" for testing
      DATA[filename][width][format] = DATA[filename][width][format] || {};
      let i = 0;
      for (let quality = 10; quality <= 100; quality += 5) {
        const existingData = DATA[filename][width][format][quality];
        if (existingData) {
          print(filename, format, width, quality, existingData);
          continue;
        }
        const p = getImageData(filename, referenceFile, format, width, quality);
        p.then((info) => {
          DATA[filename][width][format][quality] = info;
          print(filename, format, width, quality, info);
        });
        promises.push(p);
        if (i++ % 5 == 0) {
          // Reduce concurrency a bit to avoid crashing the computer.
          await Promise.all(promises);
        }
      }
    }
    await Promise.all(promises);
  }
}

async function run() {
  const promises = [];
  for (let input of [
    `${SAMPLE_PATH}/sample0.jpg`,
    `${SAMPLE_PATH}/sample1.jpg`,
    `${SAMPLE_PATH}/sample2.jpg`,
    `${SAMPLE_PATH}/sample3.jpg`,
  ]) {
    promises.push(testImage(input));
  }
  try {
    await Promise.all(promises);
  } catch (e) {
    console.error(e.stack);
    return;
  }
  console.log("Writing File\n");
  require("fs").writeFileSync(
    "./data/image-quality.json",
    JSON.stringify(DATA, null, " ")
  );
  console.log("File Written\n");
}

console.log(
  ["format", "width", "quality", "size", "dssim", "filename"].join("\t")
);
run();
