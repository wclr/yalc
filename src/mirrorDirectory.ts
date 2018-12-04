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
    newItems,
    itemsWithChangedContents,
    itemsWithChangedTypes
  } = await findNewAndChangedItems(
    itemsInSourceDirectoryExcludingNodeModulesDir,
    itemsInDestinationDirectoryExcludingNodeModulesDir
  )

  const { removedItems } = await findRemovedItems(
    itemsInSourceDirectoryExcludingNodeModulesDir,
    itemsInDestinationDirectoryExcludingNodeModulesDir
  )

  await copyItems(sourceDirectory, destinationDirectory, newItems)

  await copyItems(
    sourceDirectory,
    destinationDirectory,
    itemsWithChangedContents
  )

  await removeItems(destinationDirectory, itemsWithChangedTypes)
  await copyItems(sourceDirectory, destinationDirectory, itemsWithChangedTypes)

  await removeItems(destinationDirectory, removedItems)
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

  const rootDirPathStats = await fs.lstat(rootDir)
  if (!rootDirPathStats.isDirectory()) {
    throw new Error(
      `Cannot get items from given path '${rootDir}' because it is not a directory`
    )
  }

  const allItemAbsolutePaths: string[] = (await fs.readdir(rootDir)).map(
    itemPath => path.resolve(rootDir, itemPath)
  )

  const statsPromises: Promise<fs.Stats>[] = []
  for (let absoluteItemPath of allItemAbsolutePaths) {
    statsPromises.push(fs.lstat(absoluteItemPath))
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
      contents.push(item)

      if (item.stats.isDirectory()) {
        const subDirItems = await getAllItemsInDirectory(
          item.absolutePath,
          ignoreItemFunc,
          parentRootDir
        )
        contents.push(...subDirItems)
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
): Promise<{
  newItems: FileSystemItem[]
  itemsWithChangedContents: FileSystemItem[]
  itemsWithChangedTypes: FileSystemItem[]
}> {
  const destinationItemsAsMapKeyedOnRelativeItemPath = convertFileSystemItemArrayToMapKeyedOnRelativePath(
    destinationItems
  )

  const newItems: FileSystemItem[] = []
  const itemsWithChangedContents: FileSystemItem[] = []
  const itemsWithChangedTypes: FileSystemItem[] = []
  for (const itemInSourceDirectory of sourceItems) {
    const itemInDestinationDirectory = destinationItemsAsMapKeyedOnRelativeItemPath.get(
      itemInSourceDirectory.relativePath
    )

    const itemDiffResults = await diffItems(
      itemInSourceDirectory,
      itemInDestinationDirectory
    )

    switch (itemDiffResults) {
      case 'changed-contents':
        itemsWithChangedContents.push(itemInSourceDirectory)
        break
      case 'changed-types':
        itemsWithChangedTypes.push(itemInSourceDirectory)
        break
      case 'new':
        newItems.push(itemInSourceDirectory)
        break
      case 'same':
        break
    }
  }

  return { newItems, itemsWithChangedContents, itemsWithChangedTypes }
}

async function findRemovedItems(
  sourceItems: FileSystemItem[],
  destinationItems: FileSystemItem[]
): Promise<{ removedItems: FileSystemItem[] }> {
  const itemsInSourceDirectoryAsMap = convertFileSystemItemArrayToMapKeyedOnRelativePath(
    sourceItems
  )
  const removedItems: FileSystemItem[] = []
  for (const itemInDestinationDir of destinationItems) {
    const itemInSourceDirectory = itemsInSourceDirectoryAsMap.get(
      itemInDestinationDir.relativePath
    )

    if (itemInSourceDirectory === undefined) {
      removedItems.push(itemInDestinationDir)
    }
  }

  return { removedItems }
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
): Promise<'changed-types' | 'changed-contents' | 'new' | 'same'> {
  if (itemAtDestination !== undefined) {
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

    if (
      itemAtDestination.stats.isDirectory() ||
      itemAtSource.stats.isDirectory() ||
      itemAtDestination.stats.isSymbolicLink() ||
      itemAtSource.stats.isSymbolicLink()
    ) {
      return 'changed-types'
    }

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

  return 'new'
}

async function copyItems(
  dirToCopyFrom: string,
  dirToCopyTo: string,
  items: FileSystemItem[]
): Promise<void> {
  const itemsToCopy = items.map(item => {
    const sourceItemPath = path.resolve(dirToCopyFrom, item.relativePath)
    const destinationItemPath = path.resolve(dirToCopyTo, item.relativePath)

    if (item.stats.isDirectory()) {
      return fs.ensureDir(destinationItemPath)
    }

    return fs.copy(sourceItemPath, destinationItemPath, {
      preserveTimestamps: true
    })
  })
  await Promise.all(itemsToCopy)
}

async function removeItems(
  dirPath: string,
  items: FileSystemItem[]
): Promise<void> {
  const removeItemsPromises = items.map(item =>
    fs.remove(path.resolve(dirPath, item.relativePath))
  )
  await Promise.all(removeItemsPromises)
}
