# Publish Stringshift on GitHub Pages

This build reuses the existing converter, styles, synth player, and PDF print export. It needs no server or API key.

1. In GitHub Desktop, select Stringshift. Commit the new deployment files and click **Push origin**.
2. Open https://github.com/charlottcouzens-cloud/Stringshift/settings/pages.
3. Under **Build and deployment**, select **GitHub Actions**.
4. Open **Actions**, select **Deploy GitHub Pages**, and choose **Run workflow** on the default branch if the first run failed before Pages was enabled.
5. When build and deploy are green, open https://charlottcouzens-cloud.github.io/Stringshift/.

Future pushes to your default branch publish automatically. The workflow supports master or main. The GitHub Pages URL is not live until GitHub reports a successful deployment.

Run `npm run build:pages` to build locally. The output goes to `dist-pages/`, which is excluded from Git. The workflow uploads that output automatically.

Local builds use the /Stringshift/ path. GitHub builds obtain the actual path from actions/configure-pages. The existing npm run build command continues to build the Sites version.

Official guide: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
