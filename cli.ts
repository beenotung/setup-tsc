#!/usr/bin/env node

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { basename } from 'path'
import { cwd } from 'process'

function main() {
  let pkg = readPackageJSON()
  let { entryFile, globalName } = parseArgs(process.argv.slice(2), pkg)
  pkg.main ||= 'dist/cjs.js'
}

function parseArgs(args: string[], pkg: pkg) {
  let entryFile = ''
  let globalName = ''

  for (let i = 0; i < args.length; i++) {
    let arg = args[i]
    if (arg.startsWith('--entryFile')) {
      entryFile = arg.split('=')[1]
      continue
    }
    if (arg.startsWith('--name')) {
      globalName = arg.split('=')[1]
      continue
    }
    console.error('Unknown argument: ' + JSON.stringify(arg))
    process.exit(1)
  }

  let packageName = getPackageName(pkg)

  globalName ||= packageName

  if (globalName.startsWith('@')) {
    globalName = globalName.split('/').pop()!
  }

  globalName = capitalize(globalName)

  entryFile ||= detectFile([
    'index.ts',
    `${packageName}.ts`,
    `${packageName}`,
    'src/index.ts',
    `src/${packageName}.ts`,
    `src/${packageName}`,
  ])

  return { globalName, entryFile }
}

function detectFile(files: string[]): string {
  for (let file of files) {
    if (execFileSync(file)) return file
  }
  return files[0]
}

function readPackageJSON(): pkg {
  try {
    return JSON.parse(readFileSync('package.json').toString())
  } catch (error) {
    // file not found or invalid json
    return {}
  }
}

type pkg = Partial<{
  name: string
  main: string
}>

function getPackageName(pkg: pkg): string {
  return pkg.name || basename(cwd())
}

function capitalize(name: string): string {
  return name
    .split('-')
    .map((s, i) => (i == 0 ? s : s.slice(0, 1).toUpperCase() + s.slice(1)))
    .join('')
}

main()
