# 🧶 Knit

> Streamline your local Node.js package dependency workflow.

Knit is a fork of [yalc](https://github.com/wclr/yalc) which was created by `@wclr`, and the name is inspired by this GitHub [thread](https://github.com/yarnpkg/yarn/issues/1213).

## Why

When developing and authoring multiple packages (private or public), you often find yourself in need of using the latest/WIP versions in other projects that you are working on in your local environment **without publishing those packages to the remote registry.** NPM and Yarn address this issue with a similar approach of [symlinked packages](https://docs.npmjs.com/cli/link) (`npm/yarn link`). Though this may work in many cases, it often brings nasty [constraints and problems](https://github.com/yarnpkg/yarn/issues/1761#issuecomment-259706202) with dependency resolution, symlink interoperability between file systems, etc.

## What

- `knit` acts as very simple local repository for your locally developed packages that you want to share across your local environment.
- When you run `knit publish` in the package directory, it grabs only files that should be published to NPM and _puts_ them in a special global store (located, for example, in `~/.knit`).
- When you run `knit add my-package` in your `project` it _pulls_ package content into `.knit` in the current folder and injects a `file:`/`link:` dependency into `package.json`. Alternatively, you may use `knit link my-package` which will create a symlink to the package content in `node_modules` and will not touch `package.json` (like `npm/yarn link` does), or you even may use it with **Pnmp/Yarn/Npm workspaces**.
- `knit` creates a special `knit.lock` file in your project (similar to `yarn.lock` and `package-lock.json`) that is used to ensure consistency while performing `knit`'s routines.
- `knit` can be used with projects where `yarn` or `npm` package managers are used
  for managing `package.json` dependencies.

## Installation

Using NPM:

```
npm i knit -g
```

Using Yarn:

```
yarn global add knit
```

Some documented features might not have been published yet, see the [change log](./CHANGELOG.md).

## Usage

### Publish

- Run `knit publish` in your dependency package `my-package`.
- It will copy [all the files that should be published in remote NPM registry](https://docs.npmjs.com/files/package.json#files).
- If your package has any of these lifecycle scripts: `prepublish`, `prepare`, `prepublishOnly`, `prepack`, `preknitpublish`, they will run before in this order. If your package has any of these: `postknitpublish`, `postpack`, `publish`, `postpublish`, they will run after in this order. Use `--no-scripts` to publish without running scripts.
- When publishing, `knit` can optionally calculate a hash signature from the file contents and use the signature in the resulting package `version` (like `"1.2.3+ffffffff"`). To enable this, pass the `--sig` option to the `knit publish` command.
- You may also use `.knitignore` to exclude files from publishing to knit repo, for example, files like README.md, etc.
- `--content` flag will show included files in the published package
- **NB!** In terms of which files will be included in the package `knit` fully supposed to emulate behavior of `npm` client (`npm pack`). [If you have nested `.knit` folder in your package](https://github.com/coopbri/knit/issues/95) that you are going to publish with `knit` and you use `package.json` `files` list, it should be included there explicitly.
- **NB!** Windows users should make sure the `LF` new line symbol is used in published sources; it may be needed for some packages to work correctly (for example, `bin` scripts). `knit` won't convert line endings for you (because `npm` and `yarn` won't either).
- **NB!** Note that, if you want to include `.knit` folder in published package content, you should add `!.knit` line to `.npmignore`.
- [Easily propagate package updates everywhere.](#pushing-updates-automatically-to-all-installations)
- Knit by default resolves `workspace:` protocol in dependencies, to omit this use `-no-workspace-resolve` flag

### Add

- Run `knit add my-package` in your dependent project, which
  will copy the current version from the store to your project's `.knit` folder and inject a `file:.knit/my-package` dependency into `package.json`.
- You may specify a particular version with `knit add my-package@version`. This version will be fixed in `knit.lock` and will not affect newly published versions during updates.
- Use the `--link` option to add a `link:` dependency instead of `file:`.
- Use the `--dev` option to add knit package to dev dependencies.
- With `--pure` flag it will not touch `package.json` file, nor it will touch modules folder, this is useful for example when working with [**Yarn workspaces**](https://yarnpkg.com/lang/en/docs/workspaces/) (read below in _Advanced usage_ section)
- With `--workspace` (or `-W`) it will add dependency with "workspace:" protocol.

### Link

- As an alternative to `add`, you can use the `link` command which is similar to `npm/yarn link`, except that the symlink source will be not the global link directory but the local `.knit` folder of your project.
- After `knit` copies package content to `.knit` folder it will create a symlink:
  `project/.knit/my-package ==> project/node_modules/my-package`. It will not touch `package.json` in this case.

### Update

- Run `knit update my-package` to update the latest version from store.
- Run `knit update` to update all the packages found in `knit.lock`.
- `preknit` and `postknit` scripts will be executed in target package on add/update operations which are performed while `push`
- if need to perform pre/post `scripts` on update of particular package use `(pre|post)knit.package-name` name for script in your `package.json`.
- update `--update` (`--upgrade`, `--up`) to run package managers's update command for packages.

### Remove

- Run `knit remove my-package`, it will remove package info from `package.json` and `knit.lock`
- Run `knit remove --all` to remove all packages from project.

### Installations

- Run `knit installations clean my-package` to unpublish a package published with `knit publish`
- Run `knit installations show my-package` to show all packages to which `my-package` has been installed.

## Advanced usage

### Pushing updates automatically to all installations

- When you run `knit add|link|update`, the project's package locations are tracked and saved, so `knit` knows where each package in the store is being used in your local environment.
- `knit publish --push` will publish your package to the store and propagate all changes to existing `knit` package installations (this will actually do `update` operation on the location).
- `knit push` - is a use shortcut command for push operation (which will likely become your primarily used command for publication):
- `scripts` options is `false` by default, so it won't run `pre/post` scripts (may change this with passing `--scripts` flag).
- With `--changed` flag knit will first check if package content has changed before publishing and pushing, it is a quick operation and may be useful for _file watching scenarios_ with pushing on changes.
- Use `--replace` option to force replacement of package content.
- Use `preknit` and `postknit` (read in `update` docs) to execute needed script on every push.
- Use `--update` to run `yarn/npm/pnpm update` command for pushed packages.

### Keep it out of git

- If you are using `knit'ed` modules temporarily during development, first add `.knit` and `knit.lock` to `.gitignore`.
- Use `knit link`, that won't touch `package.json`
- If you use `knit add` it will change `package.json`, and ads `file:`/`link:` dependencies, if you may want to use `knit check` in the [precommit hook](https://github.com/typicode/husky) which will check package.json for `knit'ed` dependencies and exits with an error if you forgot to remove them.

### Keep it in git

- You may want to keep shared `knit'ed` stuff within the projects you are working on and treat it as a part of the project's codebase. This may really simplify management and usage of shared _work in progress_ packages within your projects and help to make things consistent. So, then just do it, keep `.knit` folder and `knit.lock` in git.
- Replace it with published versions from remote repository when ready.
- **NB!** - standard non-code files like `README`, `LICENCE` etc. will be included also, so you may want to exclude them in `.gitignore` with a line like `**/.knit/**/*.md` or you may use `.knitignore` not to include those files in package content.

### Publish/push sub-projects

- Useful for monorepos (projects with multiple sub-projects/packages): `knit publish some-project` will perform publish operation in the `./some-project` directory relative to `process.cwd()`

### Retreat and Restore

- Instead of completely removing package you may temporary set it back with `knit retreat [--all]` for example before package publication to remote registry.
- After or later restore it with `knit restore`.

### Use with **Yarn/Pnpm workspaces**

Use if you will try to `add` repo in `workspaces` enabled package, `--pure` option will be used by default, so `package.json` and modules folder will not be touched.

Then you add knit'ed package folder to `workspaces` in `package.json` (you may just add `.knit/*` and `.knit/@*/*` patterns). While `update` (or `push`) operation, packages content will be updated automatically and `yarn` will care about everything else.

If you want to override default pure behavior use `--no-pure` flag.

### Clean up installations file

- While working with knit for some time on the dev machine you may face the situation when you have locations where you added knit'ed packages being removed from file system, and this will cause some warning messages when knit will try to push package to removed location. To get rid of such messages, there is an explicit command for this: `knit installations clean [package]`.

### Override default package store folder

- You may use `--store-folder` flag option to override default location for storing published packages.

### Control output

- Use `--quiet` to fully disable output (except of errors). Use `--no-colors` to disable colors.

### Set default options via .knitrc

- For example add `workspace-resolve=false` line to the `.knitrc` file to turn off `workspace:` protocol resolution or `sig=false` to disable package version hash signature.

## Related links

- [yarn probably shouldn't cache packages resolved with a file path](https://github.com/yarnpkg/yarn/issues/2165)
- ["yarn knit": a better "yarn link"](https://github.com/yarnpkg/yarn/issues/1213)
- [npm-link-shared](https://github.com/OrKoN/npm-link-shared)
- [yarn link does not install package dependencies](https://github.com/yarnpkg/yarn/issues/2914)
- [[npm] RFC: file: specifier changes](https://github.com/npm/npm/pull/15900)

## Licence

The code in this repository is licensed under MIT, &copy; Brian Cooper and the original yalc work MIT &copy; Alex Osh. See <a href="LICENSE.md">LICENSE.md</a> for more information.
