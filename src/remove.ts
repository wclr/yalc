import { execSync } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import { copyWithIgnorePackageToStore } from './copy'

import {
  PackageInstallation, InstallationsFile,
  readInstallationsFile,
  addInstallations,
  removeInstallations,
  PackageName
} from './installations'

import {
  readLockfile,
  addPackageToLockfile,
  LockFilePackageEntry
} from './lockfile'

export interface RemovePackagesOptions {
  workingDir: string,
}

export const removePackages = (packages: string[], options: RemovePackagesOptions) => {

}  
