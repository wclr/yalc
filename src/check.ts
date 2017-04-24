import * as fs from 'fs-extra'
import * as path from 'path'
import { join } from 'path'
import {
  PackageManifest,
  getStorePackagesDir,
  values
} from '.'

export type CheckOptions = {
  workingDir: string,
  all?: boolean,
  commit?: boolean
}

export function checkManifest(options: CheckOptions) {
  const findLocalDepsInManifest = (manifestPath: string) => {
    const pkg = fs.readJSONSync(manifestPath) as PackageManifest
    const addresMatch = new RegExp(`^file:(.\\/)?\\${values.locedPackagesFolder}\\/`)
    
    const findDeps = (depsMap: { [name: string]: string }) =>
      Object.keys(depsMap)
        .filter(name => depsMap[name].match(addresMatch))
    const localDeps = findDeps(pkg.dependencies || {})
      .concat(findDeps(pkg.devDependencies || {}))
    return localDeps
  }

  const manifestPath = join(options.workingDir, 'package.json')
  const localDeps = findLocalDepsInManifest(manifestPath)
  if (localDeps.length) {
    console.log('Yalc dependencies found:', localDeps)
    process.exit(1)
  }
}