import * as fs from 'fs-extra'
import { join } from 'path'
import { PackageName } from './installations'

export type PackageScripts = Partial<{
  preinstall: string
  postupdate: string
  postpush: string
  prepack: string
  postpack: string
  prepare: string
  install: string
  prepublish: string
  prepublishOnly: string
  publish: string
  postpublish: string
  preyalcpublish: string
  preyalc: string
  postyalcpublish: string
  postyalc: string
}>

export interface PackageManifest {
  name: string
  version: string
  yalcSig?: string
  private?: boolean
  bin?: string | { [name: string]: string }
  dependencies?: { [name: string]: string }
  devDependencies?: { [name: string]: string }
  yalc: Partial<{
    sig: boolean
    signature: boolean
    noSig: boolean
  }>
  workspaces?: string[]
  scripts?: PackageScripts
  __JSONSpaces: number
}

export const parsePackageName = (packageName: string) => {
  const match = packageName.match(/(^@[^/]+\/)?([^@]+)@?(.*)/) || []
  if (!match) {
    return { name: '' as PackageName, version: '' }
  }
  return {
    name: ((match[1] || '') + match[2]) as PackageName,
    version: match[3] || '',
  }
}

const getJSONSpaces = (jsonStr: string) => {
  let match = jsonStr.match(/^[^{]*{.*\n([ ]+?)\S/)
  return match && match[1] ? match[1].length : null
}

export function readPackageManifest(workingDir: string) {
  let pkg: PackageManifest
  const packagePath = join(workingDir, 'package.json')
  try {
    const fileData = fs.readFileSync(packagePath, 'utf-8')
    pkg = JSON.parse(fileData) as PackageManifest
    if (!pkg.name && pkg.version) {
      console.log(
        'Package manifest',
        packagePath,
        'should contain name and version.'
      )
      return null
    }
    const formatSpaces = getJSONSpaces(fileData) || 2
    if (!formatSpaces) {
      console.warn('Could not get JSON formatting for', packagePath, 'using 2')
    }
    pkg.__JSONSpaces = formatSpaces
    return pkg
  } catch (e) {
    console.error('Could not read', packagePath)
    return null
  }
}

const sortDependencies = (dependencies: { [name: string]: string }) => {
  return Object.keys(dependencies)
    .sort()
    .reduce(
      (deps, key) => Object.assign(deps, { [key]: dependencies[key] }),
      {}
    )
}

export function writePackageManifest(workingDir: string, pkg: PackageManifest) {
  pkg = Object.assign({}, pkg)
  if (pkg.dependencies) {
    pkg.dependencies = sortDependencies(pkg.dependencies)
  }
  if (pkg.devDependencies) {
    pkg.devDependencies = sortDependencies(pkg.devDependencies)
  }
  const formatSpaces = pkg.__JSONSpaces
  delete pkg.__JSONSpaces
  const packagePath = join(workingDir, 'package.json')
  try {
    fs.writeFileSync(
      packagePath,
      JSON.stringify(pkg, null, formatSpaces) + '\n'
    )
  } catch (e) {
    console.error('Could not write ', packagePath)
  }
}
