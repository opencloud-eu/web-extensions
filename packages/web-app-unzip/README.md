# web-app-unzip

This application provides a way to extract various archive formats on the client side, including:
- ZIP archives (.zip)
- TAR archives (.tar)
- Gzip compressed TAR archives (.tar.gz, .tgz)
- Bzip2 compressed TAR archives (.tar.bz2, .tbz2) - planned support

The extraction utilizes web workers (for ZIP files) to ensure the web UI stays responsive during the process. The maximum supported archive size is 1GB.
