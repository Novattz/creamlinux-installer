{
  pkgs,
  lib,
}: let
  pythonEnv = pkgs.python3.withPackages (ps:
    with ps; [
      requests
      zipfile2
      tqdm
      rich
    ]);
in
  pkgs.stdenv.mkDerivation rec {
    pname = "creamlinux";
    version = lib.removeSuffix "\n" (builtins.readFile ./VERSION);

    src = ./.;

    buildInputs = [pythonEnv];

    buildPhase = "true";

    installPhase = ''
      mkdir -p $out/{bin,lib/${pname}}

      cp *.py $out/lib/${pname}/
      cp VERSION $out/lib/${pname}/

      # Create wrapper that adds --no-update
      cat > $out/bin/${pname} <<EOF
      #!${pkgs.bash}/bin/bash
      exec $out/lib/${pname}/main.py --no-update "\$@"
      EOF

      chmod +x $out/bin/${pname}
    '';

    meta = {
      description = "CreamLinux installer tool";
      mainProgram = pname;
    };
  }
