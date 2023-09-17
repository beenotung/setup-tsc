#!/usr/bin/env node

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { cwd } from 'process'

function main() {
  let pkg = readJSON<pkg>('package.json')
  let args = parseArgs(process.argv.slice(2), pkg)

  setupPackageJSON(pkg, args)
  setupMainTsconfig()
  setupEsbuildTsconfig(args)
}

function setupPackageJSON(pkg: pkg, args: args) {
  let { outDir, entryFile, testFile } = args

  applyTemplate('package.json', pkg, {
    main: `${outDir}/cjs.js`,
    types: `${outDir}/${basename(entryFile).replace(/\.ts$/, '.d.ts')}`,
    module: `${outDir}/esm.js`,
    browser: `${outDir}/browser.js`,
    unpkg: `${outDir}/browser.js`,
  })
  pkg.files ||= []
  addToArray(pkg.files, outDir)

  pkg.scripts ||= {}
  applyTemplate('package.json scripts', pkg.scripts, {
    test: `ts-mocha ${testFile}`,
    coverage: 'nyc npm test',
    build: 'run-s clean transpile',
    clean: 'rimraf dist',
    transpile: 'run-p esbuild tsc',
    esbuild: 'node scripts/esbuild.js',
    tsc: 'tsc -p tsconfig.esbuild.json',
  })

  pkg.devDependencies ||= {}
  applyTemplate(
    'package.json devDependencies',
    pkg.devDependencies,
    {
      '@types/chai': '^4.3.5',
      '@types/mocha': '^10.0.1',
      '@types/node': '^20.6.2',
      'chai': '^4.3.7',
      'esbuild': '^0.19.3',
      'esbuild-node-externals': '^1.9.0',
      'mocha': '^10.2.0',
      'npm-run-all': '^4.1.5',
      'nyc': '^15.1.0',
      'rimraf': '^5.0.1',
      'ts-mocha': '^10.0.0',
      'ts-node': '^10.9.1',
      'ts-node-dev': '^2.0.0',
      'typescript': '^5.2.2',
    },
    'casual',
  )
  pkg.devDependencies = sortObject(pkg.devDependencies)

  writeJSON('package.json', pkg)
}

function setupMainTsconfig() {
  let tsconfig = readJSON<tsconfig>('tsconfig.json')

  tsconfig.compilerOptions ||= {}
  applyTemplate(
    'tsconfig.json compilerOptions',
    tsconfig.compilerOptions,
    {
      target: 'es2022',
      module: 'commonjs',
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      strict: true,
      skipLibCheck: true,
      incremental: true,
      outDir: 'dist',
    },
    'casual',
  )

  tsconfig.exclude ||= []
  addToArray(tsconfig.exclude, 'dist')

  writeJSON('tsconfig.json', tsconfig)
}

function setupEsbuildTsconfig(args: args) {
  let tsconfig = readJSON<tsconfig>('tsconfig.esbuild.json')

  tsconfig.compilerOptions ||= {}
  applyTemplate(
    'tsconfig.esbuild.json compilerOptions',
    tsconfig.compilerOptions,
    {
      target: 'es2018',
      strict: true,
      noImplicitAny: true,
      moduleResolution: 'node',
      emitDeclarationOnly: true,
      declaration: true,
      skipLibCheck: true,
      outDir: 'dist',
    },
    'casual',
  )

  tsconfig.files ||= []
  addToArray(tsconfig.files, args.entryFile)

  writeJSON('tsconfig.esbuild.json', tsconfig)
}

function addToArray<T>(xs: T[], x: T) {
  if (xs.includes(x)) return
  xs.push(x)
}

function sortObject<T extends object>(object: T): T {
  return Object.fromEntries(
    Object.entries(object).sort((a, b) => compare(a[0], b[0])),
  ) as T
}

function applyTemplate<T extends object>(
  name: string,
  target: T,
  patch: T,
  mode?: 'casual',
) {
  for (let key in Object.keys(patch)) {
    if (!(key in target)) {
      // @ts-ignore
      target[key] = patch[key]
      continue
    }

    // @ts-ignore
    if (target[key] == patch[key]) {
      continue
    }

    if (mode != 'casual') {
      console.warn('Conflicting config:', { name, key })
    }
  }
}

function compare<T>(a: T, b: T): number {
  if (a < b) return -1
  if (a > b) return +1
  return 0
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

type args = ReturnType<typeof parseArgs>

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

function writeJSON(file: string, object: object) {
  writeFileSync(file, JSON.stringify(object, null, 2) + '\n')
}

function readJSON<T>(file: string): Partial<T> {
  try {
    return JSON.parse(readFileSync(file).toString())
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
  devDependencies: Record<string, string>
}>

function getPackageName(pkg: pkg): string {
  return pkg.name || basename(cwd())
}

type tsconfig = Partial<{
  compilerOptions: Record<string, any>
  files: string[]
  exclude: string[]
}>

function capitalize(name: string): string {
  return name
    .split('-')
    .map((s, i) => (i == 0 ? s : s.slice(0, 1).toUpperCase() + s.slice(1)))
    .join('')
}

main()
