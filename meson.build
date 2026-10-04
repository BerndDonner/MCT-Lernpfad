project(
  'mct-lernpfad-viewer',
  'c',
  version: '0.1.0',
  default_options: [
    'c_std=c11',
    'warning_level=3',
  ],
)

gtk4 = dependency('gtk4')
webkitgtk = dependency('webkitgtk-6.0')

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

install_subdir(
  'hosts',
  install_dir: viewer_data_dir,
)
