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

      markdownItVersion = "15.0.2";
      markdownItTarball = pkgs.fetchurl {
        url = "https://registry.npmjs.org/markdown-it/-/markdown-it-${markdownItVersion}.tgz";
        hash = "sha512-q4IGxMv56jCqT4OCRCADBoDP3LO4MhmTXjFbphHPXs4g3j9Xg5RDnxqN8IF/3vIWEU+VCnUq+7JUg/cfy2E6Qw==";
      };

      markdownItDist = pkgs.runCommand "markdown-it-${markdownItVersion}-browser-dist" {
        nativeBuildInputs = with pkgs; [ gnutar gzip ];
      } ''
        mkdir -p "$out"
        tar -xzf ${markdownItTarball}
        cp package/dist/browser/markdown-it.umd.min.js "$out/markdown-it.min.js"
        cp package/LICENSE "$out/LICENSE.markdown-it"
      '';

      updateViewerDeps = pkgs.writeShellApplication {
        name = "update-viewer-deps";
        runtimeInputs = with pkgs; [ coreutils git ];
        text = ''
          set -euo pipefail

          repo_root="$(git rev-parse --show-toplevel)"
          vendor_dir="$repo_root/vendor"

          mkdir -p "$vendor_dir"
          install -m 0644 \
            ${markdownItDist}/markdown-it.min.js \
            "$vendor_dir/markdown-it.min.js"
          install -m 0644 \
            ${markdownItDist}/LICENSE.markdown-it \
            "$vendor_dir/LICENSE.markdown-it"

          echo "Viewer dependencies updated: markdown-it ${markdownItVersion}"
          echo "Files written to: $vendor_dir"
        '';
      };

      viewer = pkgs.stdenv.mkDerivation {
        pname = "mct-lernpfad-viewer";
        version = "0.2.0";
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
        update-viewer-deps = updateViewerDeps;
      };

      apps.${system} = {
        default = {
          type = "app";
          program = "${viewer}/bin/mct-viewer";
        };

        update-viewer-deps = {
          type = "app";
          program = "${updateViewerDeps}/bin/update-viewer-deps";
        };
      };

      devShells.${system}.default = cDev {
        inherit pkgs;
        symbol = "";
        compiler = pkgs.gcc;

        extraBuildInputs = with pkgs; [
          gtk4
          webkitgtk_6_0
          gst_all_1.gst-plugins-base
        ];

        extraPackages = with pkgs; [
          python3
        ];

        message = " MCT-Lernpfad C/WebKitGTK development environment ready";
      };
    };
}
