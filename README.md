# Yalc

> Better workflow than **npm | yarn link** for package authors.

## Why

When developing and authoring multiple packages (private or public) you often find yourself in a need of using the latest/WIP versions in other projects that you are working on in your local environment **without publishing the packages to remote registry**. Npm/yarn adress this issue with standard [symlinked packages](https://docs.npmjs.com/cli/link) aproach (`npm/yarn link`). Though this approach may work in many cases, it often brings **nasty constrains and problems** with dependencies resolution, symlinks interoperability between file systems, ect.

## What

- `Yalc` acts as very simple local repository for your localy developed packages that you want to share across your local environment. 
- When you  you do `yalc publish` in the package directory it grabs only files that should be published to NPM and *puts* them to special global store (located for example in  `~/.yalc`). 
- When you do `yalc add my-package` in your `project` it *pulls* package content to `.yalc` in current folder and injects `file:` dependency in `package.json`. Alternatively you may use `yalc link my-pakage` which will create symlink to package content in `node_modules` and will not touch `package.json` (like `npm/yarn link` does).
-  `Yalc` creates special `yalc.lock` file in your project (near `yarn.lock` and `package.json`) that be used to ensure consistentcy while performing `yalc's` routines.
- `Yalc` is not tided to `yarn` it can be used in projects where `npm` client is used 
for managing `package.json` dependencies.

## Install

![npm (scoped)](https://img.shields.io/npm/v/yalc.svg?maxAge=86400) [![Build Status](https://travis-ci.org/whitecolor/yalc.svg?branch=master)](https://travis-ci.org/whitecolor/yalc)

```
  npm i yalc -g
```

*Work in progress. It is a pre-release.*

## Usage 

### Publish
- Run `yalc publish` in your dependency package `my-package`. 
- It will run `preyalc` or `prepublish` scripts before, and `postyalc` or `postpublish` after. Use `--force` to publish without running scripts.

### Add
- Run `yalc add my-package` in your dependant project, 
it will copy current version frome store to your project's `.yalc` folder and inject `file:.yalc/my-package` dependency in package.json.
- You may add particular versoin `yalc add my-package@version`, this version will be fixed in `yalc.lock` file and while updates it will not update to newly published versions.

### Link
-  Alternatively to `add` you may use `link` operation which should work for you the same way as `npm/yarn link` does, the only difference is that source for symllink will be not the global link directory but local `.yalc` folder of your project. 
- After `yalc` copies package content to `.yalc` folder it will create symlink:
`project/.yalc/my-package ==> project/node_modules/my-package`. It will not touch `package.json` in this case.

### Update
  - Run `yalc update my-package` to update the latest version from store, 
  or `yalc update` to update all the packages found in `yalc.lock`.
  - Running simply `yalc` in the directory will do the same as `yalc update`

### Remove
 - Run `yalc remove my-package`, it will remove package info from `package.json` and `yalc.lock`

----

**NB!** Currenlty `yalc` doesn't call `yarn` commands to install/update dependencies after
package is added or removed, so have to do it manually.

----

## Advanced usage

### Pushing updates automaticly to all installations

- When do `yalc add/link/update`, project's locations where packages added are tracked and saved, thus `yalc` tries to know where each package from store is being used in your local environment.
- `yalc publish --push` will publish package to store and propagate all changes to existing `yalc's` package installations (will actually do `update` operation on the location).
- You may just use shortcut for push operation `yloc push`, **which will likely become your primarily used command** for publication :
  - it support `--knit` options
  - `force` options is `true` by default, so it won't run scripts `publish/loc` scripts (may change with `--no-force` flag).

### Publish/push sub-projects

- Useful for monorepos (projects with multiple sub-projects/packages): `yalc publish package` will perform publish operation in nested `package` folder of current working dir.

### Try to use [knitting](https://github.com/yarnpkg/rfcs/blob/master/text/0000-yarn-knit.md)

- You want try to `--knit` option. Instead of just copying files from original package location to store it will create symlinks for each individual file in the package.
  
- Changes to files will be propagated immidiately to all locations as you make updates to linked files.

- It is still symlinks. Modules will be resolving their dependencies relative to their original location. [Until you use available workarounds for loaders/resolvers.](https://nodejs.org/api/cli.html#cli_preserve_symlinks)

- Excluded folders from publications like `node_modules` stay isolated to the area of use.

- When add new files you still need *may need* to push updated version to `yalc` store (for new links to be created).

### Keep out of git
- If you are using `yalk'ed` modules temporary while development, first add `.yalc` and `yalc.lock` to `.gitignore`.
- Use `yalk link`, that won't touch `packages.json`
- If you use `yalc add` it will change `package.json`, and ads `file:` dependencies, if you may want to use `yalc check` in the [precommit hook](https://github.com/typicode/husky) which will check package.json for `yalc'ed` dependencies and exits with error, if you forgot to remove them.

### Keep in git
- You may want to keep shared `yalk'ed` stuff within the projects you are working on and treat it as a part of the project's codebase. This may really simplify management and usage of shared *work in progress* packages within your projects and help to make things consistent. So, then just do it, keep `.yalc` folder and `yalc.lock` in git. 
- Replace it with published versions from remote repository when ready.


## Related links

- [yarn probably shouldn't cache packages resolved with a file path](https://github.com/yarnpkg/yarn/issues/2165)
- ["yarn knit": a better "yarn link"](https://github.com/yarnpkg/yarn/issues/1213)
- [npm-link-shared](https://github.com/OrKoN/npm-link-shared)
- [yarn link does not install package dependencies](https://github.com/yarnpkg/yarn/issues/2914)

## Licence

WTF.