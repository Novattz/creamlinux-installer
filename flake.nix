{
  description = "CreamLinux Installer";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    systems.url = "github:nix-systems/default-linux";
  };

  outputs = {
    self,
    nixpkgs,
    systems,
  }: let
    inherit (nixpkgs) lib;
    supportedSystems = import systems;
    eachSystem = lib.genAttrs supportedSystems;
    pkgsFor = eachSystem (system:
      import nixpkgs {
        inherit system;
      });
  in {
    packages = eachSystem (system: {
      creamlinux = pkgsFor.${system}.callPackage ./default.nix {};
      default = self.packages.${system}.creamlinux;
    });
  };
}
