# setup-tsc

CLI tool to setup TypeScript projects for npm and browser distribution.

[![npm Package Version](https://img.shields.io/npm/v/setup-tsc)](https://www.npmjs.com/package/setup-tsc)

## Cli Usage

```
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
```

## License

This project is licensed with [BSD-2-Clause](./LICENSE)

This is free, libre, and open-source software. It comes down to four essential freedoms [[ref]](https://seirdy.one/2021/01/27/whatsapp-and-the-domestication-of-users.html#fnref:2):

- The freedom to run the program as you wish, for any purpose
- The freedom to study how the program works, and change it so it does your computing as you wish
- The freedom to redistribute copies so you can help others
- The freedom to distribute copies of your modified versions to others
