{
  cargo-tauri,
  writeShellScriptBin,
  stdenv,
  patchelf,
  rustPlatform,
  fetchNpmDeps,
  nodejs,
  npmHooks,
  pkg-config,
  lib,
  wrapGAppsHook4,
  glib-networking,
  openssl,
  webkitgtk_4_1,
}:
let
  cargoRoot = "src-tauri";
  src = ./.;

  patchSassEmbedded = writeShellScriptBin "patch-sass-embedded" ''
    NIX_LD="$(cat ${stdenv.cc}/nix-support/dynamic-linker)"
    for dart_bin in node_modules/sass-embedded-linux-*/dart-sass/src/dart; do
      if [ -f "$dart_bin" ]; then
        ${patchelf}/bin/patchelf --set-interpreter "$NIX_LD" "$dart_bin"
      fi
    done
  '';
in
rustPlatform.buildRustPackage {
  pname = "creamlinux-installer";
  version = "1.5.6-unstable-2026-05-06";
  inherit src;

  cargoLock.lockFile = ./src-tauri/Cargo.lock;

  npmDeps = fetchNpmDeps {
    inherit src;
    hash = "sha256-6sQul8tZaCk62JL9SfDKxVShNgYdoGYOS25asugirDo=";
  };

  nativeBuildInputs = [
    cargo-tauri.hook
    nodejs
    npmHooks.npmConfigHook
    pkg-config
  ]
  ++ lib.optionals stdenv.isLinux [
    wrapGAppsHook4
  ];

  buildInputs = lib.optionals stdenv.isLinux [
    glib-networking
    openssl
    webkitgtk_4_1
  ];

  inherit cargoRoot;

  buildAndTestSubdir = cargoRoot;

  postPatch = ''
    substituteInPlace src-tauri/tauri.conf.json \
      --replace-fail '"createUpdaterArtifacts": true' '"createUpdaterArtifacts": false'
  '';

  preBuild = ''
    ${patchSassEmbedded}/bin/patch-sass-embedded
  '';

  env.NO_STRIP = true;
}
