import fsPromises from 'node:fs/promises'
import path from 'node:path'

import type { Data } from './parser.js'
import { render as astroRender } from './renderers/astro.js'
import { render as reactRender } from './renderers/react.js'
import { render as svelteRender } from './renderers/svelte.js'
import { render as vueRender } from './renderers/vue.js'

export type Extension = '.tsx' | '.astro' | '.svelte'
export type Target = 'react' | 'hono' | 'astro' | 'vue' | 'svelte'

export { parse } from './parser.js'

export async function createFiles(
  data: Data[],
  mist: string,
  targets: Readonly<[target: Target, exts: Extension]>[],
): Promise<void> {
  const promises = targets.map(([target, ext]) => {
    void createFile(data, mist, target, ext)
  })

  return Promise.all(promises).then(() => {
    return
  })
}

export async function createFile(
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
      return fsPromises.writeFile(mist.replace(/\.css$/, ext), result, {
        flush: true,
      })
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

export function getExtension(target: Target): Extension {
  switch (target) {
    case 'react':
      return '.tsx'
    case 'hono':
      return '.tsx'
    case 'astro':
      return '.astro'
    case 'vue':
      return '.tsx'
    case 'svelte':
      return '.svelte'
  }
}

export function getTarget(target: string): Target {
  switch (target) {
    case 'react':
      return 'react'
    case 'hono':
      return 'hono'
    case 'astro':
      return 'astro'
    case 'vue':
      return 'vue'
    case 'svelte':
      return 'svelte'
    default:
      throw new Error('Invalid target option')
  }
}
