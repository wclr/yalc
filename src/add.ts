import { execSync } from 'child_process'
import * as fs from 'fs-extra'
import { join } from 'path'
import * as del from 'del'
import { addInstallations } from './installations'
import * as path from 'path'

import { addPackageToLockfile } from './lockfile'

import {
  getPackageStoreDir,
  values,
  parsePackageName,
  readPackageManifest,
  writePackageManifest,
  readSignatureFile
} from '.'

const ensureSymlinkSync = fs.ensureSymlinkSync as typeof fs.symlinkSync

export interface AddPackagesOptions {
  dev?: boolean
  link?: boolean
  linkDep?: boolean
  yarn?: boolean
  safe?: boolean
  pure?: boolean
  workingDir: string
}

const getLatestPackageVersion = (packageName: string) => {
  const dir = getPackageStoreDir(packageName)
  const versions = fs.readdirSync(dir)
  const latest = versions
    .map(version => ({
      version,
      created: fs.statSync(join(dir, version)).ctime.getTime()
    }))
    .sort((a, b) => b.created - a.created)
    .map(x => x.version)[0]
  return latest || ''
}

const emptyDirExcludeNodeModules = (path: string) => {
  // TODO: maybe use fs.remove + readdir for speed.
  del.sync('**', {
    dot: true,
    cwd: path,
    ignore: '**/node_modules/**'
  })
}

const isSymlink = (path: string) => {
  try {
    return !!fs.readlinkSync(path)
  } catch (e) {
    return false
  }
}

export const addPackages = async (
  packages: string[],
  options: AddPackagesOptions
) => {
  const workingDir = options.workingDir
  const localPkg = readPackageManifest(workingDir)
  let localPkgUpdated = false
  if (!localPkg) {
    return
  }
  const doPure =
    options.pure === false ? false : options.pure || !!localPkg.workspaces
  const addedInstallsPromises = packages.map(async packageName => {
    const { name, version = '' } = parsePackageName(packageName)

    if (!name) {
      console.log('Could not parse package name', packageName)
    }

    const storedPackagePath = getPackageStoreDir(name)
    if (!fs.existsSync(storedPackagePath)) {
      console.log(
        `Could not find package \`${name}\` in store (${storedPackagePath}), skipping.`
      )
      return null
    }
    const versionToInstall = version || getLatestPackageVersion(name)

    const storedPackageDir = getPackageStoreDir(name, versionToInstall)

    if (!fs.existsSync(storedPackageDir)) {
      console.log(
        `Could not find package \`${packageName}\` ` + storedPackageDir,
        ', skipping.'
      )
      return null
    }

    const pkg = readPackageManifest(storedPackageDir)
    if (!pkg) {
      return
    }
    const destYalcCopyDir = join(workingDir, values.yalcPackagesFolder, name)

    await replaceContentsOfDirectory(destYalcCopyDir, storedPackageDir)

    let replacedVersion = ''
    if (doPure) {
      if (localPkg.workspaces) {
        if (!options.pure) {
          console.log(
            'Because of `workspaces` enabled in this package,' +
              ' --pure option will be used by default, to override use --no-pure.'
          )
        }
      }
      console.log(
        `${pkg.name}@${pkg.version} added to ${join(
          values.yalcPackagesFolder,
          name
        )} purely`
      )
    }
    if (!doPure) {
      const destModulesDir = join(workingDir, 'node_modules', name)

      if (options.link || options.linkDep) {
        ensureSymlinkSync(destYalcCopyDir, destModulesDir, 'junction')
      } else {
        if (isSymlink(destModulesDir)) {
          await fs.remove(destModulesDir)
        }

        await replaceContentsOfDirectory(destModulesDir, destYalcCopyDir)
      }

      if (!options.link) {
        const protocol = options.linkDep ? 'link:' : 'file:'
        const localAddress =
          protocol + values.yalcPackagesFolder + '/' + pkg.name

        const dependencies = localPkg.dependencies || {}
        const devDependencies = localPkg.devDependencies || {}
        let whereToAdd = options.dev ? devDependencies : dependencies

        if (options.dev) {
          if (dependencies[pkg.name]) {
            replacedVersion = dependencies[pkg.name]
            delete dependencies[pkg.name]
          }
        } else {
          if (!dependencies[pkg.name]) {
            if (devDependencies[pkg.name]) {
              whereToAdd = devDependencies
            }
          }
        }

        if (whereToAdd[pkg.name] !== localAddress) {
          replacedVersion = replacedVersion || whereToAdd[pkg.name]
          whereToAdd[pkg.name] = localAddress
          localPkg.dependencies =
            whereToAdd === dependencies ? dependencies : localPkg.dependencies
          localPkg.devDependencies =
            whereToAdd === devDependencies
              ? devDependencies
              : localPkg.devDependencies
          localPkgUpdated = true
        }
        replacedVersion = replacedVersion == localAddress ? '' : replacedVersion
      }
      const addedAction = options.link ? 'linked' : 'added'
      console.log(
        `Package ${pkg.name}@${
          pkg.version
        } ${addedAction} ==> ${destModulesDir}.`
      )
    }

    const signature = readSignatureFile(storedPackageDir)
    return {
      signature,
      name,
      version,
      replaced: replacedVersion,
      path: options.workingDir
    }
  })

  const addedInstalls = (await Promise.all(addedInstallsPromises))
    .filter(_ => !!_)
    .map(_ => _!)

  if (localPkgUpdated) {
    writePackageManifest(workingDir, localPkg)
  }

  addPackageToLockfile(
    addedInstalls.map(i => ({
      name: i!.name,
      version: i!.version,
      replaced: i!.replaced,
      pure: doPure,
      file: !options.link && !options.linkDep && !doPure,
      link: options.linkDep && !doPure,
      signature: i.signature
    })),
    { workingDir: options.workingDir }
  )

  await addInstallations(addedInstalls)

  if (options.yarn) {
    console.log('Running yarn:')
    execSync('yarn', { cwd: options.workingDir })
  }
}

async function replaceContentsOfDirectory(
  destinationDirectory: string,
  sourceDirectory: string
) {
  const itemsInSourceDirectoryExcludingNodeModulesDir = await getAllItemsInDirectory(
    sourceDirectory,
    isNodeModulesDirectory
  )

  const itemsInDestinationDirectoryExcludingNodeModulesDir = await getAllItemsInDirectory(
    destinationDirectory,
    isNodeModulesDirectory
  )

  const { newItems, changedItems } = await findNewAndChangedItems(
    itemsInSourceDirectoryExcludingNodeModulesDir,
    itemsInDestinationDirectoryExcludingNodeModulesDir
  )

  const itemsInSourceDirectoryAsMap = convertFileSystemItemArrayToMapKeyedOnRelativePath(
    itemsInSourceDirectoryExcludingNodeModulesDir
  )
  const removedItems: FileSystemItem[] = []
  for (const itemInDestinationDir of itemsInDestinationDirectoryExcludingNodeModulesDir) {
    const itemInSourceDirectory = itemsInSourceDirectoryAsMap.get(
      itemInDestinationDir.relativePath
    )

    if (itemInSourceDirectory === undefined) {
      removedItems.push(itemInDestinationDir)
    }
  }

  await copyItems(destinationDirectory, newItems)

  await copyItems(destinationDirectory, changedItems)

  await removeItems(removedItems)
}

interface FileSystemItem {
  absolutePath: string
  relativePath: string
  stats: fs.Stats
}

async function getAllItemsInDirectory(
  rootDir: string,
  ignoreItemFunc: (item: FileSystemItem) => boolean,
  parentRootDir?: string
): Promise<FileSystemItem[]> {
  parentRootDir = parentRootDir || rootDir

  if (!fs.existsSync(rootDir)) {
    return []
  }

  const rootDirPathStats = await fs.stat(rootDir)
  if (!rootDirPathStats.isDirectory()) {
    throw new Error(
      `Cannot get items from given path '${rootDir}' because it is not a directory`
    )
  }

  const allItemAbsolutePaths: string[] = (await fs.readdir(rootDir)).map(
    itemPath => path.resolve(rootDir, itemPath)
  )

  const statsPromises: Promise<fs.Stats>[] = []
  for (let entry of allItemAbsolutePaths) {
    const filePath = path.resolve(rootDir, entry)
    statsPromises.push(fs.stat(filePath))
  }
  const allItemStats: fs.Stats[] = await Promise.all(statsPromises)

  const contents: FileSystemItem[] = []
  for (let i = 0; i < allItemAbsolutePaths.length; i++) {
    const item = {
      absolutePath: allItemAbsolutePaths[i],
      relativePath: path.relative(parentRootDir, allItemAbsolutePaths[i]),
      stats: allItemStats[i]
    }

    if (!ignoreItemFunc(item)) {
      if (item.stats.isDirectory()) {
        const subDirItems = await getAllItemsInDirectory(
          item.absolutePath,
          ignoreItemFunc,
          parentRootDir
        )
        contents.push(...subDirItems)
      } else {
        contents.push(item)
      }
    }
  }

  return contents
}

const isNodeModulesDirectory = (item: FileSystemItem) =>
  item.stats.isDirectory() &&
  path.parse(item.absolutePath).base === 'node_modules'

async function findNewAndChangedItems(
  sourceItems: FileSystemItem[],
  destinationItems: FileSystemItem[]
): Promise<{ newItems: FileSystemItem[]; changedItems: FileSystemItem[] }> {
  const destinationItemsAsMapKeyedOnRelativeItemPath = convertFileSystemItemArrayToMapKeyedOnRelativePath(
    destinationItems
  )

  const newItems: FileSystemItem[] = []
  const changedItems: FileSystemItem[] = []
  for (const itemInSourceDirectory of sourceItems) {
    const itemInDestinationDirectory = destinationItemsAsMapKeyedOnRelativeItemPath.get(
      itemInSourceDirectory.relativePath
    )

    const itemDiffResults = await diffItems(
      itemInSourceDirectory,
      itemInDestinationDirectory
    )

    switch (itemDiffResults) {
      case 'changed':
        changedItems.push(itemInSourceDirectory)
        break
      case 'new':
        newItems.push(itemInSourceDirectory)
        break
      case 'same':
        break
    }
  }

  return { newItems, changedItems }
}

function convertFileSystemItemArrayToMapKeyedOnRelativePath(
  items: FileSystemItem[]
): Map<string, FileSystemItem> {
  return new Map<string, FileSystemItem>(
    items.map<[string, FileSystemItem]>(item => [item.relativePath, item])
  )
}

async function diffItems(
  itemAtSource: FileSystemItem,
  itemAtDestination: FileSystemItem | undefined
): Promise<'changed' | 'new' | 'same'> {
  if (itemAtDestination !== undefined) {
    if (
      itemAtDestination.stats.mtime.getTime() ===
        itemAtSource.stats.mtime.getTime() &&
      itemAtDestination.stats.size === itemAtSource.stats.size
    ) {
      const contentsForItemAtDestination = await fs.readFile(
        itemAtDestination.absolutePath
      )
      const contentsForItemAtSource = await fs.readFile(
        itemAtSource.absolutePath
      )

      if (contentsForItemAtDestination.equals(contentsForItemAtSource)) {
        return 'same'
      }
    }

    return 'changed'
  }

  return 'new'
}

async function copyItems(
  dirToCopyTo: string,
  items: FileSystemItem[]
): Promise<void> {
  const itemsToCopy = items.map(item =>
    fs.copy(item.absolutePath, path.resolve(dirToCopyTo, item.relativePath), {
      preserveTimestamps: true
    })
  )
  await Promise.all(itemsToCopy)
}

async function removeItems(items: FileSystemItem[]): Promise<void> {
  const removeItemsPromises = items.map(item => fs.remove(item.absolutePath))
  await Promise.all(removeItemsPromises)
}
