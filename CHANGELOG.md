# Yalc changelog

## 1.0.0.pre.45 (2020-09-30)

- remove `--force` flag
- surface STDOUT/STDERR of execSync

## 1.0.0.pre.44 (2020-09-18)

- fix removing scoped package folder

## 1.0.0.pre.43 (2020-09-17)

- try/catch for ensuring symlink when modifying bin permissions
- add signature (`yalcSig` key) to published package.json
- add `--no-scripts` to publish/push without running scripts
- add `-W` (workspaces) as alias for `--no-pure`
- prevent removing .yalc folder if something else exists there

## 1.0.0.pre.42 (2020-08-17)

- replace pre/postyalc scripts with pre/postyalcpublish
- execute pre/postyalc scripts in target package/project on add/update
- added `--quite` f to disabled output (except of errors)
- added colored output can be disabled `--no-color`
- fixed removing installations
- fixed running pm scripts

## 1.0.0.pre.41 (2020-08-06)

- add quotes around workingDir
- try/catch when modifying bin permissions

## 1.0.0.pre.40 (2020-07-24)

- remove empty directories why sync dir copy

## 1.0.0.pre.39 (2020-07-24)

- `yalc publish` now runs all of the lifecycle scripts it finds

## 1.0.0.pre.38 (2020-07-23)

- use `--pure` flag with workspaces by default
- add check for PNPM workspace for `--pure` flag

## 1.0.0.pre.37 (2020-07-05)

- allow using `--pure` flag without `workspaces`
- `--replace` flag to force replacement of content while adding/pushing package

## 1.0.0.pre.36 (2020-06-14)

- change version signature to semver metadata format (from - to +) - https://semver.org/#spec-item-10

- removed `don't forget to update/install deps` message

## 1.0.0.pre.35 (2020-01-16)

- fix --pure flag usage

## 1.0.0.pre.34 (2019-08-27)

- added `--store-folder` to override default global package store folder

## 1.0.0.pre.33 (2019-08-15)

- added lifecycle scripts, like `prepack`

## 1.0.0.pre.30 (2019-06-05)

- fix copy method

## 1.0.0.pre.29 (2019-06-03)

- new safe copy method

## 1.0.0.pre.28 (2019-05-26)

- updates .bin scripts with permissions

## 1.0.0.pre.26 (2018-12-24)

- `prepare` script
- `--private` flag to publish `private` package
- `--version` flag
- fix of `npm-packlist` that may not include nested `package.json`

## 1.0.0.pre.25 (2018-12-14)

- `--pure` flag, yarn `workspaces` support
- `--changed` option, publish/push only if package content changed
- remove `devDependencies` from published content
- `--files` option

## 1.0.0.pre.24 (2018-11-23)

- `postupdate` script on `update` (and `push`)
- new file inclusion algorithm with `npm-packlist`
- `.yalcignore` added
- installations `show/clean` commmand

## 1.0.0.pre.16 (2018-01-02)

- fix package deps
- fix `--link` removal

## 1.0.0.pre.15 (2017-12-30)

- run prepblushOnly script on publish
- fixed `darwin` os support
- fixed linking EPERM
- added `--link` option to `add` command for adding `link:` deps

## 1.0.0.pre.14 (2017-12-15)

- fix: remove package dir from node_modules only if needed

## 1.0.0.pre.13 (2017-11-22)

- fix: remove .yalc folder from ignored

## 1.0.0.pre.12 (2017-10-24)

- update `fs-extra`
- fix #7

## 1.0.0.pre.11 (2017-06-09)

- fixed include rules for `folder/file`

## 1.0.0.pre.10 (2017-05-27)

- fixed `--all` option for `retreat` command
- fixed #3 `yarn` absence error output

## 1.0.0.pre.9 (2017-05-21)

- added hash signature
- no default command
- fixed not-exiting package removal
- added `--all` option for `remove`
- handle unknown command

## 1.0.0.pre.8 (2017-05-25)

- fix copy if no `files` in manifest defined

## 1.0.0.pre.7 (2017-05-11)

- fixes `files` inclusion (#2)

## 1.0.0.pre.6 (2017-05-09)

- fixed `yarn.lock` bug

## 1.0.0.pre.5 (2017-05-07)

- copy to dest package dir not removing inner `node_modules`

## 1.0.0.pre.4 (2017-05-02)

- do not publish standard non-code files (README, LICENCE, etc.)
- remove lockfile and .yalc dir if empty

## 1.0.0.pre.3 (2017-04-28)

- use .gitignore if no `files` entry in manifest

## 1.0.0.pre.2 (2017-04-26)

- `remove` removes from `.yalc` and `node_modules`
- fixed installtion file write bug when publish
- handle `files` field in manifest

## 1.0.0.pre.1 (2017-04-25)

- fixed installation file first read
- `check` command
- `remove` and `retreat` commands

## 1.0.0.pre.0 (2017-04-23)

- publish, push, add, update
