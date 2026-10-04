{
  description = "MCT-Lernpfad viewer";

  inputs = {
    nixos-config.url = "github:BerndDonner/NixOS-Config";
    nixpkgs.follows = "nixos-config/nixpkgs";
  };

  outputs = { self, nixpkgs, nixos-config, ... }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs {
        inherit system;
      };

      cDev = import (nixos-config + "/lib/c-develop.nix");

      viewer = pkgs.stdenv.mkDerivation {
        pname = "mct-lernpfad-viewer";
        version = "0.1.0";
        src = self;

        nativeBuildInputs = with pkgs; [
          meson
          ninja
          pkg-config
          wrapGAppsHook4
        ];

        buildInputs = with pkgs; [
          gtk4
          webkitgtk_6_0
        ];

        preFixup = ''
          gappsWrapperArgs+=(
            --set MCT_VIEWER_SHELL_DIR "$out/share/mct-lernpfad-viewer"
          )
        '';

        meta = {
          description = "Lokaler GTK4/WebKitGTK-Viewer für den MCT-Lernpfad";
          mainProgram = "mct-viewer";
          platforms = [ "x86_64-linux" ];
        };
      };
    in
    {
      packages.${system} = {
        default = viewer;
        mct-viewer = viewer;
      };

      apps.${system}.default = {
        type = "app";
        program = "${viewer}/bin/mct-viewer";
      };

      devShells.${system}.default = cDev {
        inherit pkgs;
        symbol = "";
        compiler = pkgs.gcc;

        extraBuildInputs = with pkgs; [
          gtk4
          webkitgtk_6_0
        ];

        extraPackages = with pkgs; [
          python3
        ];

        message = " MCT-Lernpfad C/WebKitGTK development environment ready";
      };
    };
}
