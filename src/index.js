const GITHUB_API = "https://api.github.com";
const REPO = "ComBanana/ggdl";
const BRANCH = "admin-worker-test";

function json(data, status = 200) {
    return new Response(JSON.stringify(data, null, 2), {
        status,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

async function githubRequest(path, env, options = {}) {
    return fetch(`${GITHUB_API}${path}`, {
        ...options,
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${env.GITHUB_TOKEN}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "ggdl-admin-worker",
            ...options.headers,
        },
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (!env.GITHUB_TOKEN) {
            return json(
                {
                    ok: false,
                    error: "GITHUB_TOKEN is not configured.",
                },
                500
            );
        }

        if (url.pathname === "/") {
            return new Response("GGDL Admin Worker is running.");
        }

        if (url.pathname === "/github-test") {
            const response = await githubRequest(
                `/repos/${REPO}/contents/data/_list.json?ref=${BRANCH}`,
                env
            );

            const text = await response.text();

            if (!response.ok) {
                return json(
                    {
                        ok: false,
                        status: response.status,
                        githubResponse: text,
                    },
                    502
                );
            }

            const file = JSON.parse(text);

                    return json({
            ok: true,
            repository: REPO,
            branch: BRANCH,
            file: file.path,
            sha: file.sha,
            message: "GitHub read test succeeded.",
        });
    }

    if (url.pathname === "/get-list") {
        if (request.method !== "GET") {
            return json(
                {
                    ok: false,
                    error: "Use GET for /get-list.",
                },
                405
            );
        }

        const response = await githubRequest(
            `/repos/${REPO}/contents/data/_list.json?ref=${BRANCH}`,
            env
        );

        const text = await response.text();

        if (!response.ok) {
            return json(
                {
                    ok: false,
                    status: response.status,
                    githubResponse: text,
                },
                502
            );
        }

        const file = JSON.parse(text);

        const binaryString = atob(
    file.content.replace(/\n/g, "")
);

const bytes = Uint8Array.from(
    binaryString,
    (char) => char.charCodeAt(0)
);

const listText = new TextDecoder().decode(bytes);

const levels = JSON.parse(listText);

        return json({
            ok: true,
            repository: REPO,
            branch: BRANCH,
            file: file.path,
            sha: file.sha,
            levels,
        });
    }

    if (url.pathname === "/test-write") {
            if (request.method !== "POST") {
                return json(
                    {
                        ok: false,
                        error: "Use POST for /test-write.",
                    },
                    405
                );
            }

            const testData = {
                worker: "ggdl-admin-worker",
                test: true,
                timestamp: new Date().toISOString(),
            };

            const content = btoa(
                unescape(
                    encodeURIComponent(
                        JSON.stringify(testData, null, 4) + "\n"
                    )
                )
            );

            const filePath = `/repos/${REPO}/contents/data/_admin-test.json`;

let existingSha;

const existingResponse = await githubRequest(
    `${filePath}?ref=${BRANCH}`,
    env
);

if (existingResponse.ok) {
    const existingFile = await existingResponse.json();
    existingSha = existingFile.sha;
} else if (existingResponse.status !== 404) {
    const text = await existingResponse.text();

    return json(
        {
            ok: false,
            status: existingResponse.status,
            githubResponse: text,
        },
        502
    );
}

const response = await githubRequest(
    filePath,
    env,
    {
        method: "PUT",
        body: JSON.stringify({
            message: "Admin Worker: test write",
            content,
            branch: BRANCH,
            ...(existingSha ? { sha: existingSha } : {}),
        }),
    }
);

            const text = await response.text();

            if (!response.ok) {
                return json(
                    {
                        ok: false,
                        status: response.status,
                        githubResponse: text,
                    },
                    502
                );
            }

            const result = JSON.parse(text);

            return json({
                ok: true,
                branch: BRANCH,
                commit: result.commit?.sha,
                file: result.content?.path,
                message: "Test file successfully written to the test branch.",
            });
        }

        return json(
            {
                ok: false,
                error: "Unknown endpoint.",
            },
            404
        );
    },
};