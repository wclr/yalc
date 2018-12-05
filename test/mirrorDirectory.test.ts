import * as fs from 'fs-extra'
import { doesNotThrow, deepEqual } from 'assert'
import * as path from 'path'
import { mirrorDirectory } from '../src/mirrorDirectory'

const assertExists = (pathToCheck: string) =>
  doesNotThrow(
    () => fs.accessSync(pathToCheck),
    pathToCheck + ' does not exist'
  )

const assertFile = async (expectedContents: string, pathToCheck: string) => {
  assertExists(pathToCheck)
  const actualContents = await fs.readFile(pathToCheck, 'utf-8')
  deepEqual(actualContents, expectedContents)
}

const assertDirectory = async (pathToCheck: string) => {
  assertExists(pathToCheck)
  const stat = await fs.lstat(pathToCheck)
  deepEqual(stat.isDirectory(), true)
}

const assertSymlink = async (
  expectedSourcePath: string,
  pathToCheck: string
) => {
  assertExists(pathToCheck)
  const stat = await fs.lstat(pathToCheck)
  deepEqual(stat.isSymbolicLink(), true)
  const realPath = await fs.realpath(pathToCheck)
  deepEqual(realPath, expectedSourcePath)
}

const tmpDirectory = path.join(__dirname, 'tmp')

const mirrorDirectoryTmpDir = path.join(
  tmpDirectory,
  'mirror-directory-test-fixtures'
)

interface File {
  _: 'file'
  contents: any
}
interface Symlink {
  _: 'symlink'
  sourcePath: string
}
interface Directory {
  _: 'directory'
  contents: DirectoryContents
}
interface DirectoryContents {
  [name: string]: FileSystemItem
}
type FileSystemItem = File | Symlink | Directory

const fileWithContent = (content: string): File => ({
  _: 'file',
  contents: content
})
const directoryWithContents = (contents: DirectoryContents): Directory => ({
  _: 'directory',
  contents: contents
})
const symlinkTo = (sourcePath: string): Symlink => ({
  _: 'symlink',
  sourcePath: sourcePath
})
const emptyFile: File = fileWithContent('')

async function writeDirectoryContents(
  contents: DirectoryContents,
  destinationDirectoryPath: string
) {
  await fs.ensureDir(destinationDirectoryPath)
  for (const itemName in contents) {
    const item = contents[itemName]
    const itemDestinationPath = path.join(destinationDirectoryPath, itemName)

    if (item._ === 'file') {
      await fs.writeFile(itemDestinationPath, item.contents)
    } else if (item._ === 'directory') {
      await fs.ensureDir(itemDestinationPath)
      await writeDirectoryContents(item.contents, itemDestinationPath)
    } else {
      await fs.ensureSymlink(item.sourcePath, itemDestinationPath)
    }
  }
}

async function ensureFileSystemContainsDirectoryContents(
  contents: DirectoryContents,
  destinationDirectoryPath: string
): Promise<void> {
  await assertDirectory(destinationDirectoryPath)

  for (const itemName in contents) {
    const item = contents[itemName]
    const itemDestinationPath = path.join(destinationDirectoryPath, itemName)

    if (item._ === 'file') {
      await assertFile(item.contents, itemDestinationPath)
    } else if (item._ === 'directory') {
      await ensureFileSystemContainsDirectoryContents(
        item.contents,
        itemDestinationPath
      )
    } else {
      await assertSymlink(
        path.resolve(destinationDirectoryPath, item.sourcePath),
        itemDestinationPath
      )
    }
  }

  const actualDirectoryFilePaths = await fs.readdir(destinationDirectoryPath)
  for (const filePath of actualDirectoryFilePaths) {
    const expectedItemInContents: undefined | FileSystemItem =
      contents[filePath]

    if (expectedItemInContents === undefined) {
      throw new Error(
        `Expected item at ${path.resolve(
          destinationDirectoryPath,
          filePath
        )} to have been removed`
      )
    }
  }
}

describe('Mirror Directory', () => {
  const sourceDirectory = path.join(mirrorDirectoryTmpDir, 'source')
  const destinationDirectory = path.join(mirrorDirectoryTmpDir, 'destination')

  const fileInRoot = 'file.txt'
  const packageJsonInRoot = 'package.json'
  const folderInRoot = 'folder'
  const folder2InRoot = 'folder2'
  const symlinkInRoot = 'symlinkToFolder'
  const folderInRootContents = {
    [fileInRoot]: emptyFile,
    'file.md': emptyFile
  }
  const sourceDirectoryContents: DirectoryContents = {
    [fileInRoot]: emptyFile,
    [folderInRoot]: directoryWithContents(folderInRootContents),
    [folder2InRoot]: directoryWithContents({
      nested: directoryWithContents({
        'file.txt': emptyFile
      }),
      [fileInRoot]: emptyFile,
      'symlinkToFile.txt': symlinkTo(`./${fileInRoot}`)
    }),
    [packageJsonInRoot]: fileWithContent(
      '{ "name": "dep-package", "version": "1.0.0" }'
    ),
    [symlinkInRoot]: symlinkTo(`./${folder2InRoot}`)
  }
  beforeEach(async () => {
    await fs.remove(sourceDirectory)
    await writeDirectoryContents(sourceDirectoryContents, sourceDirectory)
    await fs.remove(destinationDirectory)
    await mirrorDirectory(destinationDirectory, sourceDirectory)
  })

  it('should copy contents from source into destination', async () => {
    await ensureFileSystemContainsDirectoryContents(
      sourceDirectoryContents,
      destinationDirectory
    )
  })

  describe('when copying changed content from source', () => {
    it('should copy new content', async () => {
      const modifiedSourceDirectoryContent: DirectoryContents = {
        ...sourceDirectoryContents,
        ...{
          [fileInRoot]: fileWithContent('some content'),
          'some-new-file.txt': emptyFile
        }
      }
      await writeDirectoryContents(
        modifiedSourceDirectoryContent,
        sourceDirectory
      )
      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await ensureFileSystemContainsDirectoryContents(
        modifiedSourceDirectoryContent,
        destinationDirectory
      )
    })

    it('should remove old content', async () => {
      const modifiedFolderInRootContent = { ...folderInRootContents }
      delete modifiedFolderInRootContent[fileInRoot]

      const modifiedSourceDirectoryContent = {
        ...sourceDirectoryContents,
        [folderInRoot]: directoryWithContents(modifiedFolderInRootContent)
      }

      await fs.remove(sourceDirectory)
      await writeDirectoryContents(
        modifiedSourceDirectoryContent,
        sourceDirectory
      )

      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await ensureFileSystemContainsDirectoryContents(
        modifiedSourceDirectoryContent,
        destinationDirectory
      )
    })

    it('should replace file with directory, if one of the same name exists and looks the same', async () => {
      const fileToBeReplacedInDestination = path.join(
        destinationDirectory,
        fileInRoot
      )
      const stats = await fs.stat(fileToBeReplacedInDestination)

      const fileToReplaceWithFolder = path.join(sourceDirectory, fileInRoot)
      await fs.remove(fileToReplaceWithFolder)
      await fs.ensureDir(fileToReplaceWithFolder)
      await fs.utimes(fileToReplaceWithFolder, stats.atime, stats.mtime)

      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await assertDirectory(fileToBeReplacedInDestination)
    })

    it('should replace directory with file, if one of the same name exists and looks the same', async () => {
      const relativePathToFolderToReplace = folderInRoot
      const directoryToBeReplacedInDestination = path.join(
        destinationDirectory,
        relativePathToFolderToReplace
      )
      const stats = await fs.stat(directoryToBeReplacedInDestination)

      const folderToReplaceWithFile = path.join(
        sourceDirectory,
        relativePathToFolderToReplace
      )
      await fs.remove(folderToReplaceWithFile)
      await fs.ensureFile(folderToReplaceWithFile)
      await fs.utimes(folderToReplaceWithFile, stats.atime, stats.mtime)

      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await assertFile('', directoryToBeReplacedInDestination)
    })

    it('should replace file with symlink, if one of the same name exists and looks the same', async () => {
      const fileToBeReplacedInDestination = path.join(
        destinationDirectory,
        fileInRoot
      )
      const stats = await fs.stat(fileToBeReplacedInDestination)

      const symlinkSourceAbsolutePath = path.resolve(
        sourceDirectory,
        packageJsonInRoot
      )
      const symlinkRelativeSourcePath = path.relative(
        sourceDirectory,
        symlinkSourceAbsolutePath
      )
      const fileToReplaceInSource = path.join(sourceDirectory, fileInRoot)
      await fs.remove(fileToReplaceInSource)
      await fs.ensureSymlink(symlinkRelativeSourcePath, fileToReplaceInSource)
      await fs.utimes(fileToReplaceInSource, stats.atime, stats.mtime)

      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await assertSymlink(
        path.resolve(destinationDirectory, symlinkRelativeSourcePath),
        fileToBeReplacedInDestination
      )
    })

    it('should replace directory with symlink, if one of the same name exists and looks the same', async () => {
      const folderToBeReplacedInDestination = path.join(
        destinationDirectory,
        folderInRoot
      )
      const stats = await fs.stat(folderToBeReplacedInDestination)

      const symlinkSourceAbsolutePath = path.resolve(
        sourceDirectory,
        folder2InRoot
      )
      const symlinkRelativeSourcePath = path.relative(
        sourceDirectory,
        symlinkSourceAbsolutePath
      )
      const folderToReplaceInSource = path.join(sourceDirectory, folderInRoot)
      await fs.remove(folderToReplaceInSource)
      await fs.ensureSymlink(symlinkRelativeSourcePath, folderToReplaceInSource)
      await fs.utimes(folderToReplaceInSource, stats.atime, stats.mtime)

      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await assertSymlink(
        path.resolve(destinationDirectory, symlinkRelativeSourcePath),
        folderToBeReplacedInDestination
      )
      // should also not delete file.txt located in the symlinked folder
      await assertFile(
        '',
        path.resolve(destinationDirectory, folder2InRoot, fileInRoot)
      )
    })

    it('should replace symlink with file, if one of the same name exists and looks the same', async () => {
      const symlinkToBeReplacedInDestination = path.join(
        destinationDirectory,
        symlinkInRoot
      )
      const stats = await fs.lstat(symlinkToBeReplacedInDestination)

      const symlinkToReplaceInSource = path.join(sourceDirectory, symlinkInRoot)
      await fs.remove(symlinkToReplaceInSource)
      await fs.ensureFile(symlinkToReplaceInSource)
      await fs.utimes(symlinkToReplaceInSource, stats.atime, stats.mtime)

      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await assertFile('', symlinkToBeReplacedInDestination)
    })

    it('should replace symlink with directory, if one of the same name exists and looks the same', async () => {
      const symlinkToBeReplacedInDestination = path.join(
        destinationDirectory,
        symlinkInRoot
      )
      const stats = await fs.lstat(symlinkToBeReplacedInDestination)

      const symlinkToReplaceInSource = path.join(sourceDirectory, symlinkInRoot)
      await fs.remove(symlinkToReplaceInSource)
      await fs.ensureDir(symlinkToReplaceInSource)
      await fs.utimes(symlinkToReplaceInSource, stats.atime, stats.mtime)

      await mirrorDirectory(destinationDirectory, sourceDirectory)

      await assertDirectory(symlinkToBeReplacedInDestination)
    })

    it('should not touch file in destination if unchanged in source', async () => {
      const pathToFileInRootInDestination = path.join(
        destinationDirectory,
        fileInRoot
      )
      let fileWatcher: fs.FSWatcher | undefined
      let fileEvents: string[] = []
      fileWatcher = fs.watch(pathToFileInRootInDestination, event => {
        fileEvents.push(event)
      })

      await mirrorDirectory(destinationDirectory, sourceDirectory)

      if (fileWatcher) {
        fileWatcher.close()
      }

      if (fileEvents.length > 0) {
        throw new Error(
          `Expected ${pathToFileInRootInDestination} to not be updated because it is the same but fs events [${fileEvents.toString()}] occurred`
        )
      }
    })
  })
})
