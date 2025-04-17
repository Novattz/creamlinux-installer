{
  pkgs,
  fetchFromGitHub,
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
    version = "1.0.9";

    src = fetchFromGitHub {
      owner = "Novattz";
      repo = "creamlinux-installer";
      # rev = "v${version}";
      rev = "f9e7c2f614d45d3c286692ea9f0356788c515103";
      sha256 = "sha256-ej61Kl9TLnUh1HWbQ2PLV1n6hNeWcN2MHxqCvZ1jOpc=";
    };

    buildInputs = [pythonEnv];

    # Apply local patch file
    patches = [./001-use-xdg.patch];

    buildPhase = "true";

    installPhase = ''
      mkdir -p $out/{bin,lib/${pname}}

      cp *.py $out/lib/${pname}/

      sed -i '1i #!/usr/bin/env python3' $out/lib/${pname}/main.py
      chmod +x $out/lib/${pname}/main.py

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
