import * as fs from 'fs-extra'
import * as path from 'path'
import { getStoreDir, values } from '.'

export type AddedInstallations = ({ name: string, path: string } | null)[]
export type InstallationsConfig = { [packageName: string]: string[] }

export const readInstallationsFile = (): InstallationsConfig => {
  const storeDir = getStoreDir()
  const installationFilePath = path.join(storeDir, values.installationsFile)
  fs.ensureFileSync(installationFilePath)
  let installationsConfig: InstallationsConfig
  try {
    installationsConfig = fs.readJsonSync(installationFilePath, 'utf-8')
  } catch (e) {
    installationsConfig = {}
  }
  return installationsConfig
}

export const saveInstallationsFile = (installationsConfig: InstallationsConfig) => {
  const storeDir = getStoreDir()
  const installationFilePath = path.join(storeDir, values.installationsFile)
  fs.writeJson(installationFilePath, installationsConfig)
}

export const addInstallations = (installations: AddedInstallations) => {
  const installationsConfig = readInstallationsFile()
  let updated = false
  installations.filter(i => !!i)
    .forEach(newInstall => {
      const packageInstallPaths = installationsConfig[newInstall!.name] || []
      installationsConfig[newInstall!.name] = packageInstallPaths
      const hasInstallation = !!packageInstallPaths
        .filter(p => p === newInstall!.path)[0]
      if (!hasInstallation) {
        updated = true
        packageInstallPaths.push(newInstall!.path)
      }
    })

  if (updated) {
    saveInstallationsFile(installationsConfig)
  }
}
