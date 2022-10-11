# Changelog
> **Dart** Polisher - Code formatter - VSCode Extension.


## [Unreleased]
### Upstream fixes from Dart-Code:
- [Dart-Code #4134](https://github.com/Dart-Code/Dart-Code/issues/4134): When using the Dart: Capture Logs commands, long lines are no longer truncated. Logs written to disk using the related settings are still truncated based on the polisher.maxLogLineLength setting.

### Added
- New setting for logging verbose comunication between the extension and the local polisher server.
### Changed
- Improved logging.

----------
## [0.9.0] - 2022-09-20

- Supports for tab and space indents.
- `Ontype` formatting now working properly.
----------
## [0.8.9] - 2022-09-20

- Better error reporting, log files options, and catch errors in responses from formatter server.
----------
## [0.8.8] - 2022-09-14

- New configurable indents (`tab size`) for different expressions.
- `Ontype` formatting not working for now until i change protocol to use content changes.
----------
## [0.0.1] - 2014-05-31
- Initial verion
- Cloning only the most usdefault files from Dart-Code


The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

[Unreleased]: https://github.com/xnfo-dart/dart-polisher-vscode/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/xnfo-dart/dart-polisher-vscode/releases/tag/v0.9.0
[0.8.9]: https://github.com/xnfo-dart/dart-polisher-vscode/releases/tag/v0.8.9
