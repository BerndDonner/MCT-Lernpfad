project(
  'mct-lernpfad-viewer',
  'c',
  version: '0.2.0',
  default_options: [
    'c_std=c11',
    'warning_level=3',
  ],
)

gtk4 = dependency('gtk4')
webkitgtk = dependency('webkitgtk-6.0')

fs = import('fs')
if not fs.exists('vendor/markdown-it.min.js') or not fs.exists('vendor/LICENSE.markdown-it')
  error('Vendorte Viewer-Abhängigkeiten fehlen. Bitte `nix run .#update-viewer-deps` ausführen.')
endif

executable(
  'mct-viewer',
  'viewer/main.c',
  dependencies: [gtk4, webkitgtk],
  install: true,
)

viewer_data_dir = join_paths(get_option('datadir'), 'mct-lernpfad-viewer')

install_data(
  'index.html',
  'viewer.js',
  'viewer.css',
  install_dir: viewer_data_dir,
)

install_data(
  'vendor/markdown-it.min.js',
  'vendor/LICENSE.markdown-it',
  install_dir: join_paths(viewer_data_dir, 'vendor'),
)

install_subdir(
  'hosts',
  install_dir: viewer_data_dir,
)
