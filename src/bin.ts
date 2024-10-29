#!/usr/bin/env node
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import { parseArgs } from 'node:util'

import chokidar from 'chokidar'
import { globby } from 'globby'

import {
  type Extension,
  type Target,
  createFiles,
  getExtension,
  getTarget,
} from './core.js'
import { parse } from './parser.js'

function usage() {
  console.log(`Usage: mistcss <directory> [options]
  --watch, -w    Watch for changes
  --target, -t   Render target (react, vue, astro, hono, svelte) [default: react]
`)
}

// Parse args
const { values, positionals } = parseArgs({
  options: {
    watch: {
      type: 'boolean',
      short: 'w',
    },
    target: {
      type: 'string',
      short: 't',
      default: ['react'],
      multiple: true,
    },
  },
  allowPositionals: true,
})
const dir = positionals.at(0)

// Validate args
if (!dir) {
  console.error('Please provide a directory')
  usage()
  process.exit(1)
}

if (!(await fsPromises.stat(dir)).isDirectory()) {
  console.error('The path provided is not a directory')
  usage()
  process.exit(1)
}

const target = values.target ?? []

target.forEach((target) => {
  try {
    getTarget(target)
  } catch (e) {
    console.error('Invalid render option')
    usage()
    process.exit(1)
  }
})

// Set extension
function setExtension(
  targetStr: string,
): readonly [target: Target, ext: Extension] {
  const target = getTarget(targetStr)
  const ext = getExtension(target)

  switch (target) {
    case 'react':
      console.log('Rendering React components')
      break
    case 'hono':
      console.log('Rendering Hono components')
      break
    case 'astro':
      console.log('Rendering Astro components')
      break
    case 'vue':
      console.log('Rendering Vue components')
      break
    case 'svelte':
      console.log('Rendering Svelte components')
      break
  }

  return [target, ext] as const
}

const targetWithExt = target.map(setExtension)

// Change directory
const cwd = dir || process.cwd()
process.chdir(cwd)

// Watch mist files
if (values.watch) {
  console.log('Watching for changes')
  chokidar
    .watch('**/*.mist.css')
    .on('change', (file) => {
      try {
        const data = parse(fs.readFileSync(file, 'utf8'))
        void createFiles(data, file, targetWithExt)
      } catch (e) {
        if (e instanceof Error) {
          console.error(`Error ${file}: ${e.message}`)
        } else {
          console.error(`Error ${file}`)
          console.error(e)
        }
      }
    })
    .on('unlink', (file) => {
      targetWithExt.forEach(([, ext]) => {
        void fsPromises.unlink(file.replace(/\.css$/, ext))
      })
    })
}

// Build out files
const cssFiles = await globby('**/*.mist.css')
await Promise.all(
  cssFiles.map(async (mist) => {
    try {
      const data = parse(await fsPromises.readFile(mist, 'utf8'))
      createFiles(data, mist, targetWithExt)
    } catch (e) {
      if (e instanceof Error) {
        console.error(`Error ${mist}: ${e.message}`)
      } else {
        console.error(`Error ${mist}`)
        console.error(e)
      }
    }
  }),
)

// Clean out files without a matching mist file
const promises = targetWithExt.map(async ([, ext]) =>
  globby(`**/*.mist.${ext}`).then(async (files) =>
    Promise.all(files.map((file) => unlink(file, ext))),
  ),
)

await Promise.all(promises)

// Implemented last because VSCode highlights are broken.
async function unlink(file: string, ext: Extension): Promise<void> {
  const regex = new RegExp(`.${ext}$`)

  const mist = file.replace(regex, '.css')

  if (!fs.existsSync(mist)) {
    return fsPromises.unlink(mist)
  }
}
