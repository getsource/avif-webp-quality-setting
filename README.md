# WordPress Image Quality Testing

## Purpose
This is a fork of the "AVIF WebP quality settings" project, originally [Created by Malte Ubl](https://www.industrialempathy.com/), modified to allow for testing WordPress' image generation and determining the best quality settings to use.

Because WordPress doesn't officially support writing AVIF, this currently only generates WebP images for comparison with JPEG.

As a lot of steps are currently necessary, there is room for things to be automated / streamlined. PRs are welcome!

## Instructions for Use
### Setup
* Clone this repo into your preferred location.
* Install Dependencies
    * Install [Node.js](https://nodejs.org/en/).
    * Install [dssim](https://github.com/kornelski/dssim).
    * Run `npm install` within the checkout.
    * Check out the [WordPress Core development environment](https://github.com/wordpress/wordpress-develop/), and get the Docker environment running.
* Create `.env` file or set an environment variable for `IQG_WORDPRESS_PATH` to the path to your WordPress development environment. \
    (additional variables are available inside `scripts/image-quality-generate.js` for testing with different environments).
* Copy the images from `quality-samples` that you want to test to the `IQG_SAMPLE_PATH`. This path defaults to `/src/wp-content/quality-samples` inside `IQG_WORDPRESS_PATH`. The names will need to match those in `scripts/image-quality-generate.js`.

### Generate Data
* Run `node scripts/image-quality-generate.js > data/image-quality.tsv`. \
    This will generate images in the specified `quality-samples` directory, and append to `data/image-quality.json`. You may need to empty this file if there is already data for your `quality-samples` location.
* Sanitize `data/image-quality.json` and `data/image-quality.tsv` for your `IQG_WORDPRESS_PATH`, by running a search/replace if publishing, and including your local path is not desired.
* Run `node scripts/image-quality-compare.js > data/image-quality-reference.tsv`. \
    This will use `data/image-quality.json` to create `data/image-quality-reference.json` and capture the output for use in the pivot table.

### Visualize Data
* Create Web Front-end to visualize data:
    * Run `node scripts/generate-html.js`. \
        This will create `index.html` to visualize the output from both `data/image-quality.json` and `./data/image-quality-reference.json`.
    * Copy the generated image samples back from `IQG_SAMPLE_PATH` into the project's `quality-samples` folder.
* Create Pivot Table:
    * Make your own copy of an existing spreadsheet with data, like [this one](https://docs.google.com/spreadsheets/d/1E29kPLR5_0PThsw6SVbco7HvMU0aynBLfVN0RfIXgPk/edit#gid=1107534790) from Malte Ubl's data.
    * In your copy, leaving the header, remove the existing data rows in the first sheet.
    * Go to "File->Import->Upload", and choose `data/image-quality-reference.tsv`.
    * Choose "Import Location->Append to Current Sheet" and click "Import Data".
    * The pivot table should update for the new information.
* Note which version of DSSIM was used to generate the data on the report, in a commit, or otherwise, so that others can reproduce your findings. The scale [has changed between versions](https://github.com/kornelski/dssim#interpreting-the-values).

## Additional Notes
### Re-running
* Clean out any entries in `data/image-quality.json` that you want to be re-generated. Otherwise, the script will resume from where it left off. This is useful in the case of resource exhaustion, which has been encountered when using Imagick during testing.
* Right now, the process generates extra files that end up in `IQG_SAMPLE_PATH`, including PHP scripts that generated in order to be able to run using WP-CLI within the WP Docker Environment. This means that between runs, cleaning out `IQG_SAMPLE_PATH` is necessary.

Something like this will take care of clearing all the generated files and data to start again:
`rm data/image-quality*; echo "{}" > data/image-quality.json && rm $IQG_SAMPLE_PATH/sample*-*.*`

Right now, this script spawns WP-CLI within Docker for each of the generated images, which isn't ideal. Ideally this would be able to run natively inside the Docker environment (or another environment). However, doing so requires the dependencies of this project to be present, so it isn't currently done.

For context on the original project, [see the blog post on AVIF and WebP encoding quality settings](https://www.industrialempathy.com/posts/avif-webp-quality-settings/).
