import * as fs from 'fs-extra'
import * as path from 'path'

export async function mirrorDirectory(
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

  const {
    itemsThatAreNew,
    itemsWithChangedContents,
    itemsWithChangedTypes,
    itemsToRemove
  } = await diffItemsInDirectories(
    sourceDirectory,
    itemsInSourceDirectoryExcludingNodeModulesDir,
    destinationDirectory,
    itemsInDestinationDirectoryExcludingNodeModulesDir
  )

  await copyItems(sourceDirectory, destinationDirectory, itemsThatAreNew)

  await copyItems(
    sourceDirectory,
    destinationDirectory,
    itemsWithChangedContents
  )

  await removeItems(destinationDirectory, itemsWithChangedTypes)
  await copyItems(sourceDirectory, destinationDirectory, itemsWithChangedTypes)

  await removeItems(destinationDirectory, itemsToRemove)
}

interface FileSystemItem {
  stats: fs.Stats
  absolutePath: string
}
interface NonDirectoryFileSystemItemDescription {
  stats: fs.Stats
  dirContents: undefined
}
interface DirectoryDescription {
  stats: fs.Stats
  dirContents: DirectoryContents
}
type FileSystemItemDescription =
  | NonDirectoryFileSystemItemDescription
  | DirectoryDescription
interface DirectoryContents {
  [name: string]: FileSystemItemDescription
}

async function getAllItemsInDirectory(
  directoryPath: string,
  ignoreItemFunc: (item: FileSystemItem) => boolean
): Promise<DirectoryContents> {
  if (!fs.existsSync(directoryPath)) {
    return {}
  }

  const rootDirPathStats = await fs.lstat(directoryPath)
  if (!rootDirPathStats.isDirectory()) {
    throw new Error(
      `Cannot get items from given path '${directoryPath}' because it is not a directory`
    )
  }

  const itemRelativePaths: string[] = await fs.readdir(directoryPath)

  const statsPromises: Promise<fs.Stats>[] = []
  for (let itemPath of itemRelativePaths) {
    statsPromises.push(fs.lstat(path.resolve(directoryPath, itemPath)))
  }
  const allItemStats: fs.Stats[] = await Promise.all(statsPromises)

  const contents: DirectoryContents = {}
  for (let i = 0; i < itemRelativePaths.length; i++) {
    const relativePath = itemRelativePaths[i]
    const itemDescription = {
      absolutePath: path.resolve(directoryPath, relativePath),
      stats: allItemStats[i]
    }

    if (!ignoreItemFunc(itemDescription)) {
      contents[relativePath] = await getFileSystemItemDescription(
        itemDescription,
        ignoreItemFunc
      )
    }
  }

  return contents
}

async function getFileSystemItemDescription(
  itemDescription: FileSystemItem,
  ignoreItemFunc: (item: FileSystemItem) => boolean
): Promise<FileSystemItemDescription> {
  if (itemDescription.stats.isDirectory()) {
    const subDirItems = await getAllItemsInDirectory(
      itemDescription.absolutePath,
      ignoreItemFunc
    )
    return {
      dirContents: subDirItems,
      stats: itemDescription.stats
    }
  }
  return {
    dirContents: undefined,
    stats: itemDescription.stats
  }
}

const isNodeModulesDirectory = (item: FileSystemItem) =>
  item.stats.isDirectory() &&
  path.parse(item.absolutePath).base === 'node_modules'

async function diffItemsInDirectories(
  sourceDirectoryPath: string,
  sourceDirectoryContents: DirectoryContents,
  destinationDirectoryPath: string,
  destinationDirectoryContents: DirectoryContents
): Promise<{
  itemsThatAreNew: string[]
  itemsWithChangedContents: string[]
  itemsWithChangedTypes: string[]
  itemsToRemove: string[]
}> {
  const itemsThatAreNew: string[] = []
  const itemsWithChangedContents: string[] = []
  const itemsWithChangedTypes: string[] = []
  const itemsToRemove: string[] = []
  for (const itemRelativePath in sourceDirectoryContents) {
    const destinationItemDescription: FileSystemItemDescription | undefined =
      destinationDirectoryContents[itemRelativePath]

    if (destinationItemDescription === undefined) {
      itemsThatAreNew.push(itemRelativePath)
      continue
    }

    const sourceItemDescription = sourceDirectoryContents[itemRelativePath]
    const sourceItemAbsolutePath = path.resolve(
      sourceDirectoryPath,
      itemRelativePath
    )
    const destinationItemAbsolutePath = path.resolve(
      destinationDirectoryPath,
      itemRelativePath
    )

    if (
      sourceItemDescription.dirContents !== undefined &&
      destinationItemDescription.dirContents !== undefined
    ) {
      const subDiffResults = await diffItemsInDirectories(
        sourceItemAbsolutePath,
        sourceItemDescription.dirContents,
        destinationItemAbsolutePath,
        destinationItemDescription.dirContents
      )
      const appendCurrentRelativePath = (subItemRelativePath: string) =>
        path.join(itemRelativePath, subItemRelativePath)

      itemsThatAreNew.push(
        ...subDiffResults.itemsThatAreNew.map(appendCurrentRelativePath)
      )
      itemsWithChangedContents.push(
        ...subDiffResults.itemsWithChangedContents.map(
          appendCurrentRelativePath
        )
      )
      itemsWithChangedTypes.push(
        ...subDiffResults.itemsWithChangedTypes.map(appendCurrentRelativePath)
      )
      itemsToRemove.push(
        ...subDiffResults.itemsToRemove.map(appendCurrentRelativePath)
      )
    }

    const sourceItem: FileSystemItem = {
      absolutePath: sourceItemAbsolutePath,
      stats: sourceItemDescription.stats
    }

    const destinationItem: FileSystemItem = {
      absolutePath: destinationItemAbsolutePath,
      stats: destinationItemDescription.stats
    }

    const itemDiffResults = await diffItems(sourceItem, destinationItem)
    switch (itemDiffResults) {
      case 'changed-contents':
        itemsWithChangedContents.push(itemRelativePath)
        break
      case 'changed-types':
        itemsWithChangedTypes.push(itemRelativePath)
        break
      case 'same':
        break
    }
  }

  for (const itemRelativePath in destinationDirectoryContents) {
    const sourceItemDescription: FileSystemItemDescription | undefined =
      sourceDirectoryContents[itemRelativePath]

    if (sourceItemDescription === undefined) {
      itemsToRemove.push(itemRelativePath)
    }
  }

  return {
    itemsThatAreNew,
    itemsWithChangedContents,
    itemsWithChangedTypes,
    itemsToRemove
  }
}

async function diffItems(
  itemAtSource: FileSystemItem,
  itemAtDestination: FileSystemItem
): Promise<'changed-types' | 'changed-contents' | 'same'> {
  if (
    itemAtDestination.stats.isDirectory() &&
    itemAtSource.stats.isDirectory()
  ) {
    return 'same'
  }

  if (
    itemAtDestination.stats.isSymbolicLink() &&
    itemAtSource.stats.isSymbolicLink()
  ) {
    const destinationSymlinkRealPath = await fs.realpath(
      itemAtDestination.absolutePath
    )
    const sourceSymlinkRealPath = await fs.realpath(
      itemAtDestination.absolutePath
    )
    if (destinationSymlinkRealPath === sourceSymlinkRealPath) {
      return 'same'
    }

    return 'changed-types'
  }

  if (itemAtDestination.stats.isFile() && itemAtSource.stats.isFile()) {
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

    return 'changed-contents'
  }

  return 'changed-types'
}

async function copyItems(
  dirToCopyFrom: string,
  dirToCopyTo: string,
  itemRelativePaths: string[]
): Promise<void> {
  const itemsToCopy = itemRelativePaths.map(itemRelativePath => {
    const sourceItemPath = path.resolve(dirToCopyFrom, itemRelativePath)
    const destinationItemPath = path.resolve(dirToCopyTo, itemRelativePath)

    return fs.copy(sourceItemPath, destinationItemPath, {
      preserveTimestamps: true
    })
  })
  await Promise.all(itemsToCopy)
}

async function removeItems(
  dirToRemoveFrom: string,
  itemsRelativePaths: string[]
): Promise<void> {
  const removeItemsPromises = itemsRelativePaths.map(itemRelativePath =>
    fs.remove(path.resolve(dirToRemoveFrom, itemRelativePath))
  )
  await Promise.all(removeItemsPromises)
}
