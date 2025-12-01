# GitHub Dependencies

The following dependencies are installed directly from GitHub repositories and require symlink setup:

- `@zk-kit/binary-merkle-root.circom` → `Vishalkulkarni45/zk-kit.circom#fix/bin-merkle-tree`
- `anon-aadhaar-circuits` → `selfxyz/anon-aadhaar#main`

These are handled by the `postinstall` script (`scripts/postinstall-github-deps.sh`) which creates the necessary symlinks for circom include paths to work correctly.
