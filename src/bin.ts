#!/usr/bin/env node
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'

import chokidar from 'chokidar'
import { globby } from 'globby'

import { Data, parse } from './parser.js'
import { render as astroRender } from './renderers/astro.js'
import { render as reactRender } from './renderers/react.js'
import { render as svelteRender } from './renderers/svelte.js'
import { render as vueRender } from './renderers/vue.js'

type Extension = '.tsx' | '.astro' | '.svelte'
type Target = 'react' | 'hono' | 'astro' | 'vue' | 'svelte'

async function createFiles(
  mist: string,
  targets: Readonly<[target: Target, exts: Extension]>[],
): Promise<void> {
  try {
    const data = parse(fs.readFileSync(mist, 'utf8'))

    const promises = targets.map(([target, ext]) => {
      void createFile(data, mist, target, ext)
    })

    return Promise.all(promises).then(() => {
      return
    })
  } catch (e) {
    if (e instanceof Error) {
      console.error(`Error ${mist}: ${e.message}`)
    } else {
      console.error(`Error ${mist}`)
      console.error(e)
    }
  }
}

async function createFile(
  data: Data[],
  mist: string,
  target: Target,
  ext: Extension,
): Promise<void> {
  try {
    const name = path.basename(mist, '.mist.css')
    if (data[0]) {
      let result = ''
      switch (target) {
        case 'react':
          result = reactRender(name, data[0])
          break
        case 'hono':
          result = reactRender(name, data[0], true)
          break
        case 'astro':
          result = astroRender(name, data[0])
          break
        case 'vue':
          result = vueRender(name, data[0])
          break
        case 'svelte':
          result = svelteRender(name, data[0])
          break
      }
      return fsPromises.writeFile(mist.replace(/\.css$/, ext), result)
    }
  } catch (e) {
    if (e instanceof Error) {
      console.error(`Error ${mist}: ${e.message}`)
    } else {
      console.error(`Error ${mist}`)
      console.error(e)
    }
  }
}

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
  if (
    target !== 'react' &&
    target !== 'hono' &&
    target !== 'astro' &&
    target !== 'vue' &&
    target !== 'svelte'
  ) {
    console.error('Invalid render option')
    usage()
    process.exit(1)
  }
})

// Set extension
function setExtension(
  target: string,
): readonly [target: Target, ext: Extension] {
  switch (target) {
    case 'react':
      console.log('Rendering React components')
      return [target, '.tsx'] as const
    case 'hono':
      console.log('Rendering Hono components')
      return [target, '.tsx'] as const
    case 'astro':
      console.log('Rendering Astro components')
      return [target, '.astro'] as const
    case 'vue':
      console.log('Rendering Vue components')
      return [target, '.tsx'] as const
    case 'svelte':
      console.log('Rendering Svelte components')
      return [target, '.svelte'] as const
    default:
      console.error('Invalid target option')
      usage()
      process.exit(1)
  }
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
    .on('change', (file) => void createFiles(file, targetWithExt))
    .on('unlink', (file) => {
      targetWithExt.forEach(([, ext]) => {
        void fsPromises.unlink(file.replace(/\.css$/, ext))
      })
    })
}

// Build out files
const cssFiles = await globby('**/*.mist.css')
await Promise.all(cssFiles.map((mist) => createFiles(mist, targetWithExt)))

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
