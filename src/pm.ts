import { execSync, ExecSyncOptions } from 'child_process'
import * as fs from 'fs-extra'
import { join } from 'path'
import { execLoudOptions } from '.'

type PackageMangerName = 'yarn' | 'npm' | 'pnpm'

export const pmMarkFiles: { [P in PackageMangerName]: string[] } = {
  pnpm: ['pnpm-lock.yaml'],
  yarn: ['yarn.lock'],
  npm: ['package-lock.json'],
}

export const pmInstallCmd: { [P in PackageMangerName]: string } = {
  pnpm: 'pnpm install',
  yarn: 'yarn',
  npm: 'npm install',
}

export const pmUpdateCmd: { [P in PackageMangerName]: string } = {
  pnpm: 'pnpm update',
  yarn: 'yarn upgrade',
  npm: 'npm update',
}

export const pmRunScriptCmd: { [P in PackageMangerName]: string } = {
  pnpm: 'pnpm',
  yarn: 'yarn',
  npm: 'npm run',
}

const defaultPm = 'npm'

export const getPackageManager = (cwd: string): PackageMangerName => {
  const pms = Object.keys(pmMarkFiles) as PackageMangerName[]
  return (
    pms.reduce<PackageMangerName | false>((found, pm) => {
      return (
        found ||
        (pmMarkFiles[pm].reduce<PackageMangerName | false>(
          (found, file) => found || (fs.existsSync(join(cwd, file)) && pm),
          false
        ) &&
          pm)
      )
    }, false) || defaultPm
  )
}

export const getRunScriptCmd = (cwd: string) =>
  pmInstallCmd[getPackageManager(cwd)]

export const getPackageManagerInstallCmd = (cwd: string) =>
  pmInstallCmd[getPackageManager(cwd)]

export const getPackageManagerUpdateCmd = (cwd: string) =>
  pmUpdateCmd[getPackageManager(cwd)]

export const isYarn = (cwd: string) => getPackageManager(cwd) === 'yarn'

export const runPmUpdate = (workingDir: string, packages: string[]) => {
  const pkgMgrCmd = [getPackageManagerUpdateCmd(workingDir), ...packages].join(
    ' '
  )

  console.log(`Running ${pkgMgrCmd} in ${workingDir}`)
  execSync(pkgMgrCmd, { cwd: workingDir, ...execLoudOptions })
}
