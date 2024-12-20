{ lib, pkgs, fetchFromGitHub }:

pkgs.stdenv.mkDerivation rec {
  pname = "creamlinux";
  version = "v1.0.8";

  src = fetchFromGitHub {
    owner = "Novattz";
    repo = "creamlinux-installer";
    rev = "0a74ba0f4c171de84172d3aaef7c74a8770bb604";
    sha256 = "sha256-wOzNE6PsGhRsWBuIVQPN/5+aKjl0Gq45qLrL6DceLDM=";
  };

  propagatedBuildInputs = [
    (pkgs.python3.withPackages (pythonPackages: with pythonPackages; [
      requests 
      zipfile2 
      tqdm 
    ]))
    ];

  dontUnpack = true;
  installPhase = ''
    install -Dm755 ${./dlc_fetcher.py} $out/bin/${pname}
  '';
}

