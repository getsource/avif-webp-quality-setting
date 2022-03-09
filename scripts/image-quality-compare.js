const data = require("../data/image-quality.json");

const reference = {};

for (let filename in data) {
  reference[filename] = {};
  for (let width in data[filename]) {
    reference[filename][width] = {};
    const formats = data[filename][width];
    for (let refQuality = 70; refQuality < 100; refQuality++) { // of [50, 55, 60, 65, 70, 75, 80, 85, 90, 95]) {
      reference[filename][width][refQuality] = {};
      const ref = formats.jpeg[refQuality];
      for (let format of ["webp"]) {
        reference[filename][width][refQuality][format] = {};
        for (let quality in formats[format]) {
          const info = formats[format][quality];
          const sizeReduction = `${
            100 - Math.round((info.size / ref.size) * 100)
          }%`;
          if (
            info.dssim <= ref.dssim ||
            Math.abs(info.dssim - ref.dssim) <= 0.0005
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
