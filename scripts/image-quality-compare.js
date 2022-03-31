const data = require("../data/image-quality.json");

const reference = {};

// Test each sample image, one by one.
for (let filename in data) {
  reference[filename] = {};

  // Test each of the sizes of each sample file
  for (let width in data[filename]) {
    reference[filename][width] = {};
    const formats = data[filename][width];

    // Step through each reference (JPEG) quality setting, from 70-100
    for (let refQuality = 70; refQuality < 100; refQuality++) {
      reference[filename][width][refQuality] = {};
      const ref = formats.jpeg[refQuality];
      for (let format of ["webp"]) { // only test webp
        reference[filename][width][refQuality][format] = {};

        // Iterate by the quality levels of WebP, from 70-100.
        for (let quality in formats[format]) {
          const info = formats[format][quality];
          const sizeReduction = `${
            100 - Math.round((info.size / ref.size) * 100)
          }%`;

          // Output the result if the current WebP dssim is "close enough", or equal/lower than the reference.
          if (
            info.dssim <= ref.dssim // ||
            // Math.abs(info.dssim - ref.dssim) <= 0.000243 // this is the smallest difference I've found that still gives the same amount of results.
          ) {
            reference[filename][width][refQuality][format] = {
              quality,
              sizeReduction,
            };
            console.log(
              [
                width,
                refQuality,
                format,
                quality,
                sizeReduction,
                filename,
              ].join("\t")
            );

            /* Stop looking for a match if one was found that is close enough,
             * or same / better quality, and move to the next reference quality (refQuality) to test.
             */
            break;
          }
        }
      }
    }
  }
}

require("fs").writeFileSync(
  "./data/image-quality-reference.json",
  JSON.stringify(reference, null, " ")
);
