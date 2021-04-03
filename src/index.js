import { flattenSVG } from 'flatten-svg'
import { reorder, merge, elideShorterThan } from 'optimize-paths'

const svgString = `<svg viewBox="0 0 600 400">
  <g transform="translate(10 10)">
    <rect x="0" y="0" width="30" height="10" />
    <path d="M0 0 l10 0 l0 10 l-10 0 Z" />
  </g>
</svg>`

/**
 * Parse an SVG from a string in a safe way, preventing any embedded JavaScript
 * from running.
 */
function parseSVG(svgString) {
  // Create an iframe
  const ifr = document.createElement('iframe')
  // Hide it. display: none doesn't work here as that will prevent the iframe
  // from loading.
  ifr.setAttribute('style', 'width: 0; height: 0; border: 0; position: absolute;')
  ifr.setAttribute('tabindex', '-1')
  // Apply the sandbox attribute, which prevents JavaScript from running (among
  // other limitations). Specifically allow same-origin access because we will
  // need to access the contents of the iframe.
  ifr.setAttribute('sandbox', 'allow-same-origin')
  // Set the srcdoc attribute to the SVG string to be parsed
  ifr.srcdoc = svgString
  // Parsing does not begin until the iframe is added to the document
  document.body.appendChild(ifr)
  // Wait until the iframe has finished loading
  return new Promise((resolve, reject) => {
    ifr.onload = () => resolve(ifr)
  })
}

/**
 * Helper function for parsing an SVG, calling a function with the SVG element,
 * and then cleaning up.
 */
async function withSVG(svgString, fn) {
  const ifr = await parseSVG(svgString)
  try {
    const svg = ifr.contentWindow.document.querySelector('svg')
    if (!svg)
      throw new Error('document did not contain an <svg> element')

    return await Promise.resolve(fn(svg))
  } finally {
    ifr.remove()
  }
}

async function main() {
  const paths = await withSVG(svgString, (svg) => flattenSVG(svg))
  const lines = paths.map(l => l.points)

  // If you have rescaling logic, e.g. to scale the SVG to a certain paper
  // size, you should apply it here before optimization.

  // You might not always want to elide short paths, as some plots rely on them
  // to make points. Eliding is O(n) in the total number of points in the SVG.
  const elided = elideShorterThan(lines, 0.5)

  // Reordering is the most expensive operation, being O(n^2) in the number of
  // paths. It's still quite fast for most SVGs. A reasonable limit is
  // somewhere around 10,000 paths.
  const reordered = reorder(elided)

  // Merging is best done after reordering, as reordering is likely to put the
  // start of one line close to the end of another line.
  // Merging is O(n) in the total number of points in the SVG.
  // You could also experiment with running another merge step earlier in the
  // pipeline, before reordering. For some SVGs that might cause reordering to
  // run faster.
  const optimized = merge(reordered)
  console.log(optimized)
}

main()
