import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname } from 'path'
import { cwd } from 'process'

function main() {
  let pkg = readJSON<pkg>('package.json')
  let args = parseArgs(process.argv.slice(2), pkg)

  setupPackageJSON(pkg, args)
  setupMainTsconfig()
  setupBrowserFile(args)
  setupEntryFile(args)
  setupGitIgnore(args)
}

function setupPackageJSON(pkg: pkg, args: args) {
  let { outDir, entryFile, testFile } = args

  applyTemplate('package.json', pkg, {
    type: 'module',
    main: `${outDir}/${basename(entryFile).replace(/\.ts$/, '.js')}`,
    types: `${outDir}/${basename(entryFile).replace(/\.ts$/, '.d.ts')}`,
    module: `${outDir}/esm.js`,
    browser: `${outDir}/browser.js`,
    unpkg: `${outDir}/browser.js`,
  })
  pkg.files ||= []
  addToArray(pkg.files, outDir)

  pkg.scripts ||= {}
  applyTemplate('package.json scripts', pkg.scripts, {
    'test': `ts-mocha ${testFile}`,
    'coverage': 'nyc npm test',
    'build': 'run-s clean transpile',
    'clean': 'rimraf dist',
    'transpile': 'run-p esbuild:* tsc',
    'esbuild:browser': 'esbuild --bundle --outfile=dist/browser.js browser.ts',
    'esbuild:esm': `esbuild --bundle --outfile=dist/esm.js --platform=node --format=esm ${entryFile}`,
    'tsc': 'tsc -p .',
  })

  pkg.devDependencies ||= {}
  applyTemplate(
    'package.json devDependencies',
    pkg.devDependencies,
    {
      '@types/chai': '^4.3.16',
      '@types/mocha': '^10.0.7',
      '@types/node': '^20.14.11',
      'chai': '^4.4.1',
      'esbuild': '^0.23.0',
      'mocha': '^10.6.0',
      'npm-run-all': '^4.1.5',
      'nyc': '^17.0.0',
      'rimraf': '^6.0.1',
      'ts-mocha': '^10.0.0',
      'ts-node': '^10.9.2',
      'ts-node-dev': '^2.0.0',
      'typescript': '^5.5.3',
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
      declaration: true,
      forceConsistentCasingInFileNames: true,
      strict: true,
      skipLibCheck: true,
      incremental: false,
      outDir: 'dist',
    },
    'casual',
  )

  tsconfig.exclude ||= []
  addToArray(tsconfig.exclude, 'dist')

  tsconfig.files ||= []
  addToArray(tsconfig.files, 'index.ts')

  writeJSON('tsconfig.json', tsconfig)
}

function setupBrowserFile(args: args) {
  let { globalName, entryFile, browserFile } = args
  let importName = basename(entryFile).replace(/\.ts$/, '')
  let code = `
import * as ${globalName} from './${importName}'

declare const window: any
window.${globalName} = ${globalName}
`
  mkdirSync(dirname(browserFile), { recursive: true })
  writeCode(browserFile, code)
}

function setupEntryFile(args: args) {
  try {
    readFileSync(args.entryFile)
  } catch (error) {
    let code = `
export let name = '${args.globalName}'
`
    writeCode(args.entryFile, code)
  }
}

function setupGitIgnore(args: args) {
  let file = '.gitignore'
  let text: string
  try {
    text = readFileSync(file).toString()
  } catch (error) {
    // file not found
    text = ''
  }
  const originalText = text

  function addLine(pattern: string) {
    let match = text.split('\n').find(line => {
      line = line.trim().replace(/#.*/, '').trim()
      return line == pattern || line == pattern + '/'
    })
    if (match) return
    if (text.trim() && !text.endsWith('\n')) text += '\n'
    text += pattern
  }

  addLine(args.outDir)
  addLine('node_modules')
  addLine('.nyc_output')
  addLine('*.tgz')
  addLine('package-lock.json')
  addLine('pnpm-lock.yaml')
  addLine('yarn.lock')

  text = text.split('\r').join('')
  if (!text.endsWith('\n')) text += '\n'
  if (text != originalText) {
    writeFileSync(file, text)
  }
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
  for (let key of Object.keys(patch)) {
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
    if (arg == '-h' || arg == '--help') {
      console.log(helpMessage())
      process.exit(0)
    }
    console.error('Unknown argument: ' + JSON.stringify(arg))
    process.exit(1)
  }

  let packageName = getPackageName(pkg)

  globalName ||= packageName

  if (globalName.startsWith('@')) {
    globalName = globalName.split('/').pop()!
  }
  if (globalName.endsWith('.js') || globalName.endsWith('.ts')) {
    globalName = globalName.slice(0, globalName.length - 3)
  }
  globalName = globalName.replaceAll('.', '-')

  globalName = camelCase(globalName)

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

  let browserFile = entryFile.replace(basename(entryFile), 'browser.ts')

  return { globalName, entryFile, browserFile, testFile, outDir }
}

type args = ReturnType<typeof parseArgs>

function parseArgValue(arg: string): string {
  let value = arg.split('=')[1]
  if (value) return value
  console.error('Missing argument value for: ' + JSON.stringify(arg))
  console.error('Example: ' + arg.replace('=', '') + '=value')
  process.exit(1)
}

function helpMessage(): string {
  return `
Usage: setup-tsc [options]

Optional Options:
  --entryFile=<path>          Specify the entry .ts file.
                              If not specified, it's automatically inferred (see details below).
  --name|--global|--globalName=<string>
                              Specify the global name for the browser .js file.
                              If not specified, it's derived from the package name or directory name.
  --outDir=<path>             Specify the output directory for build output.
                              Default is 'dist'.
  -h, --help                  Display usage information.

Options Details:

  --entryFile:
    If this option is not specified, the entry file is inferred from a list of potential names.
    Here, '<packageName>' is either the package name or the current working directory's name.
    Possible names include 'index.ts', '<packageName>.ts', <packageName>,
    'src/index.ts', 'src/<packageName>.ts', and 'src/<packageName>'.
    Note: If the package name ends with '.ts', '<packageName>' is also a valid entry file name.

  --globalName:
    If the global name begins with '@', the name is derived from the part after the '/' in the package name,
    and it is converted into camelCase.
    For instance, '--globalName=@my-scope/my-package' results in a global name of 'myPackage'.

Examples:
  $ setup-tsc --entryFile=./src/core.ts --globalName=oklab
  $ setup-tsc --outDir=./build
  $ npx setup-tsc
`
}

function detectFile(files: string[]): string {
  for (let file of files) {
    if (existsSync(file)) return file
  }
  return files[0]
}

function writeJSON(file: string, object: object) {
  writeCode(file, JSON.stringify(object, null, 2))
}

function writeCode(file: string, code: string) {
  writeFileSync(file, code.trim() + '\n')
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
  type: string
  name: string
  main: string
  types: string
  module: string
  browser: string
  unpkg: string
  files: string[]
  scripts: Partial<{
    'test': string
    'coverage': string
    'build': string
    'clean': string
    'transpile': string
    'esbuild:browser': string
    'esbuild:esm': string
    'tsc': string
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

function camelCase(name: string): string {
  return name
    .split('-')
    .map((s, i) => (i == 0 ? s : s.slice(0, 1).toUpperCase() + s.slice(1)))
    .join('')
}

main()
