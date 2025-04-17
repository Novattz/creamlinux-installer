{
  config,
  lib,
  pkgs,
  ...
}: let
  creamlinux = pkgs.callPackage (./package.nix) {};
in {
  options.cfg.gaming = {
    creamlinux.enable = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = "Enables creamlinux-installer.";
    };
  };

  config = {
    home.packages = with pkgs; [
      (lib.mkIf config.cfg.gaming.creamlinux.enable creamlinux)
    ];
  };
}
