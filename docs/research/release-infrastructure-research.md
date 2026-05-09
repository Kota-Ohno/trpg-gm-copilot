# Release Infrastructure Research

Date: 2026-05-09
Scope: initial public release for `つぎたく`

## Decision Summary

Use Cloudflare Pages for the first public release. It gives the lowest operational burden for a Vite static SPA, can start at zero hosting cost, supports GitHub-connected builds, custom domains, and static security headers through a `_headers` file.

Avoid S3 + CloudFront for the first release unless there is a specific AWS governance requirement. CloudFront is a strong production CDN, but the first release does not need S3 bucket policy, certificate, invalidation, budget, log, and IAM management overhead.

## Official Source Notes

- Cloudflare Pages documents a Free plan with 500 builds per month and custom domain support. It also supports static redirects and headers files in the deployment output.
- Cloudflare Pages framework docs support Vite projects with `pnpm run build` and `dist` output.
- GitHub Pages is viable for static sites, but GitHub documents soft limits including 100 GB bandwidth per month and build/runtime constraints.
- Netlify is viable for static deploy previews, but the current free tier is credit-based and less predictable for a cost-sensitive launch.
- Vercel is excellent for Next.js and static frontends, but the Hobby tier is aimed at personal/non-commercial use; it is not the best default for a public product release that may become commercial.
- AWS CloudFront has a generous free tier, but production setup needs more moving parts than this static app currently requires.

Primary references:

- Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Cloudflare Pages Vite guide: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
- Cloudflare Pages headers: https://developers.cloudflare.com/pages/configuration/headers/
- GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- Netlify pricing: https://www.netlify.com/pricing/
- Vercel pricing: https://vercel.com/pricing
- AWS CloudFront FAQ/free tier: https://aws.amazon.com/cloudfront/faqs/
- Amazon S3 pricing/free tier: https://aws.amazon.com/s3/pricing/

## Hosting Comparison

| Option | Initial cost | Fit | Main risk |
| --- | ---: | --- | --- |
| Cloudflare Pages | 0 JPY possible | Best default for static Vite SPA, custom domain, security headers, simple rollback. | Commercial SLA and advanced observability require paid/adjacent services later. |
| GitHub Pages | 0 JPY possible | Fastest OSS demo path. | Soft bandwidth limits and fewer edge/security controls. |
| Netlify | 0 JPY possible | Strong preview workflow. | Credit model can be less predictable for a strict zero-cost target. |
| Vercel | 0 JPY possible | Excellent frontend DX. | Hobby terms and limits are less suitable if release becomes commercial. |
| S3 + CloudFront | 0 JPY to low cost possible | Strong AWS-native production path. | IAM, bucket policy, invalidations, certificates, budgets, logs, and accidental-cost controls add launch overhead. |

## Product And Privacy Fit

`つぎたく` currently has no required backend. A static host preserves the product's local-first boundary:

- Campaign data remains in browser storage.
- Provider keys remain session-only.
- Provider requests go directly from the user's browser to OpenAI, local Ollama, or another configured endpoint.
- No application server receives campaign logs or provider keys.

This also keeps launch cost near zero, but it means the app cannot provide account sync, server backups, provider-key isolation, or abuse controls. Those should be treated as future hosted/pro architecture decisions.

## Security Header Notes

The initial `_headers` file uses:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` denying camera and geolocation while allowing microphone on self for the optional Web Speech flow
- A CSP that allows self assets, OpenAI API calls, and local `localhost`/`127.0.0.1` provider calls

The CSP intentionally does not allow arbitrary remote provider endpoints. If custom remote provider endpoints become a supported public feature, the CSP and privacy notice must be revisited before release.

The CSP also intentionally avoids `upgrade-insecure-requests` because local Ollama-style endpoints commonly use `http://localhost`.

## Recommendation

Launch order:

1. Cloudflare Pages with `pages.dev` URL.
2. Verify public URL manually with a fresh browser profile and no API key.
3. Add a low-cost custom domain only after the first smoke test passes.
4. Defer S3 + CloudFront until AWS-native governance, paid SLA, or multi-environment requirements justify the complexity.
