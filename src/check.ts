import * as fs from 'fs-extra'
import * as path from 'path'
import { PackageManifest, values, findPackage } from '.'

export type CheckOptions = {
  workingDir: string
  all?: boolean
}

export function checkManifest(options: CheckOptions) {
  const findLocalDepsInManifest = (manifestPath: string) => {
    const pkg = fs.readJSONSync(manifestPath) as PackageManifest
    const addresMatch = new RegExp(
      `^(file|link):(.\\/)?\\${values.yalcPackagesFolder}\\/`
    )

    const findDeps = (depsMap: { [name: string]: string }) =>
      Object.keys(depsMap).filter(name => depsMap[name].match(addresMatch))
    const localDeps = findDeps(pkg.dependencies || {}).concat(
      findDeps(pkg.devDependencies || {})
    )
    return localDeps
  }

  const workingDir = findPackage(options.workingDir)
  if (!workingDir) {
    console.log('Not inside a package')
    return process.exit(1)
  }

  const localDeps = findLocalDepsInManifest(
    path.join(workingDir, 'package.json')
  )
  if (localDeps.length) {
    console.log('Yalc dependencies found:', localDeps)
    process.exit(1)
  }
}
