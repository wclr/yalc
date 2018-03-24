# Yalc

> Better workflow than **npm | yarn link** for package authors.

## Why

When developing and authoring multiple packages (private or public), you often find yourself in need of using the latest/WIP versions in other projects that you are working on in your local environment **without publishing those packages to remote registry.** NPM and Yarn address this issue with a similar approach of [symlinked packages](https://docs.npmjs.com/cli/link) (`npm/yarn link`). Though this may work in many cases, it often brings nasty [constraints and problems](https://github.com/yarnpkg/yarn/issues/1761#issuecomment-259706202) with dependency resolution, symlink interoperability between file systems, etc.

## What

- `yalc` acts as very simple local repository for your localy developed packages that you want to share across your local environment.
- When you run `yalc publish` in the package directory, it grabs only files that should be published to NPM and *puts* them in a special global store (located, for example, in  `~/.yalc`). 
- When you run `yalc add my-package` in your `project` it *pulls* package content into `.yalc` in the current folder and injects a `file:`/`link:` dependency into `package.json`. Alternatively, you may use `yalc link my-package` which will create a symlink to the package content in `node_modules` and will not touch `package.json` (like `npm/yarn link` does).
-  `yalc` creates a special `yalc.lock` file in your project (similar to `yarn.lock` and `package.json`) that is used to ensure consistency while performing `yalc`'s routines.
- `yalc` can be used with projects where `yarn` or `npm` package managers are used 
for managing `package.json` dependencies.

## Installation

![npm (scoped)](https://img.shields.io/npm/v/yalc.svg?maxAge=86400) [![Build Status](https://travis-ci.org/whitecolor/yalc.svg?branch=master)](https://travis-ci.org/whitecolor/yalc)

Using NPM:

```
npm i yalc -g
```

Using Yarn:

```
yarn global add yalc
```

## Usage

### Publish
- Run `yalc publish` in your dependency package `my-package`. 
- It will copy [all the files that should be published in remote NPM registry](https://docs.npmjs.com/files/package.json#files), but will not include standard non-code files like `README`, `LICENCE` etc. (If you need them included, add `!LICENCE` to `.npmignore`).
- It will run `preyalc` or `prepublish` scripts before, and `postyalc` or `postpublish` after. Use `--force` to publish without running scripts.

- **NB!** Windows users should make sure the `LF` new line symbol is used in published sources; it may be needed for some packages to work correctly (for example, `bin` scripts). `yalc` won't convert line endings for you (because `npm` and `yarn` won't either).

- While copying package content, `yalc` calculates the hash signature of all files and, by default, adds this signature to the package manifest `version`. You can disable this by using the `--no-sig` option.

- [Easily propagate package updates everywhere.](#pushing-updates-automaticaly-to-all-installations)

### Add
- Run `yalc add my-package` in your dependent project, which
will copy the current version from the store to your project's `.yalc` folder and inject a `file:.yalc/my-package` dependency into `package.json`.
- You may specify a particular version with `yalc add my-package@version`. This version will be fixed in `yalc.lock` and during updates it will not affect newly published versions.
- Use the `--link` option to add a `link:` dependency instead of `file:`.
- Use the `--dev` option to add yalc package to dev dependencies.

### Link
-  As an alternative to `add`, you can use the `link` command which is similar to `npm/yarn link`, except that the symlink source will be not the global link directory but the local `.yalc` folder of your project. 
- After `yalc` copies package content to `.yalc` folder it will create a symlink:
`project/.yalc/my-package ==> project/node_modules/my-package`. It will not touch `package.json` in this case.

### Update
- Run `yalc update my-package` to update the latest version from store.
- Run `yalc update` to update all the packages found in `yalc.lock`.
  
### Remove
 - Run `yalc remove my-package`, it will remove package info from `package.json` and `yalc.lock`
 - Run `yalc remove --all` to remove all packages from project.

----

**NB!** Currently, `yalc` copies (or links) added/updated package content to the `node_modules` folder, but it doesn't execute `yarn/npm` install/update commands after this, so dependencies must be updated manually if necessary.

----

## Advanced usage

### Pushing updates automatically to all installations

- When you run `yalc add|link|update`, the project's package locations are tracked and saved, so `yalc` knows where each package in the store is being used in your local environment.
- `yalc publish --push` will publish your package to the store and propagate all changes to existing `yalc` package installations (this will actually do `update` operation on the location).
- `yalc push` - is a use shortcut command for push operation (which will likely become your primarily used command for publication):
  - `force` options is `true` by default, so it won't run `pre/post` scripts (may change this with `--no-force` flag).

### Keep it out of git
- If you are using `yalc'ed` modules temporary while development, first add `.yalc` and `yalc.lock` to `.gitignore`.
- Use `yalc link`, that won't touch `packages.json`
- If you use `yalc add` it will change `package.json`, and ads `file:`/`link:` dependencies, if you may want to use `yalc check` in the [precommit hook](https://github.com/typicode/husky) which will check package.json for `yalc'ed` dependencies and exits with error, if you forgot to remove them.

### Keep it in git
- You may want to keep shared `yalc'ed` stuff within the projects you are working on and treat it as a part of the project's codebase. This may really simplify management and usage of shared *work in progress* packages within your projects and help to make things consistent. So, then just do it, keep `.yalc` folder and `yalc.lock` in git. 
- Replace it with published versions from remote repository when ready.

### Publish/push sub-projects

- Useful for monorepos (projects with multiple sub-projects/packages): `yalc publish package-dir will perform publish operation in nested `package` folder of current working dir.


## Related links

- [yarn probably shouldn't cache packages resolved with a file path](https://github.com/yarnpkg/yarn/issues/2165)
- ["yarn knit": a better "yarn link"](https://github.com/yarnpkg/yarn/issues/1213)
- [npm-link-shared](https://github.com/OrKoN/npm-link-shared)
- [yarn link does not install package dependencies](https://github.com/yarnpkg/yarn/issues/2914)
- [[npm] RFC: file: specifier changes](https://github.com/npm/npm/pull/15900)

## Licence

WTF.
