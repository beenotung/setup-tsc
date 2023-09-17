#!/usr/bin/env node

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { basename } from 'path'
import { cwd } from 'process'

function main() {
  let pkg = readPackageJSON()
  let { globalName, entryFile, testFile, outDir } = parseArgs(
    process.argv.slice(2),
    pkg,
  )
  pkg.main ||= `${outDir}/cjs.js`
  pkg.types ||= `${outDir}/${basename(entryFile).replace(/\.ts$/, '.d.ts')}`
  pkg.module ||= `${outDir}/esm.js`
  pkg.browser ||= `${outDir}/browser.js`
  pkg.unpkg ||= pkg.browser
  pkg.files ||= []
  if (!pkg.files.includes(outDir)) {
    pkg.files.push(outDir)
  }
  pkg.scripts ||= {}
  pkg.scripts.test ||= `ts-mocha ${testFile}`
  pkg.scripts.coverage ||= 'nyc npm test'
  pkg.scripts.build ||= 'run-s clean transpile'
  pkg.scripts.clean ||= 'rimraf dist'
  pkg.scripts.transpile ||= 'run-p esbuild tsc'
  pkg.scripts.esbuild ||= 'node scripts/esbuild.js'
  pkg.scripts.tsc ||= 'tsc -p tsconfig.esbuild.json'
}

function parseArgs(args: string[], pkg: pkg) {
  let entryFile = ''
  let globalName = ''
  let outDir = 'dist'

  for (let i = 0; i < args.length; i++) {
    let arg = args[i]
    if (arg.startsWith('--entryFile')) {
      entryFile = parseArgValue(arg)
      continue
    }
    if (
      arg.startsWith('--name') ||
      arg.startsWith('--global') ||
      arg.startsWith('--globalName')
    ) {
      globalName = parseArgValue(arg)
      continue
    }
    if (arg.startsWith('--outDir')) {
      outDir = parseArgValue(arg)
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

  let testFile = detectFile([
    entryFile.replace(/\.ts$/, '.spec.ts'),
    entryFile.replace(/\.ts$/, '.test.ts'),
  ])

  return { globalName, entryFile, testFile, outDir }
}

function parseArgValue(arg: string): string {
  let value = arg.split('=')[1]
  if (value) return value
  console.error('Missing argument value for: ' + JSON.stringify(arg))
  console.error('Example: ' + arg.replace('=', '') + '=value')
  process.exit(1)
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
  types: string
  module: string
  browser: string
  unpkg: string
  files: string[]
  scripts: Partial<{
    test: string
    coverage: string
    build: string
    clean: string
    transpile: string
    esbuild: string
    tsc: string
  }>
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
