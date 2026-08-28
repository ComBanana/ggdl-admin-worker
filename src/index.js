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

function encodeBase64(text) {
    return btoa(
        unescape(
            encodeURIComponent(text)
        )
    );
}

function decodeBase64(base64) {
    const binaryString = atob(
        base64.replace(/\n/g, "")
    );

    const bytes = Uint8Array.from(
        binaryString,
        (char) => char.charCodeAt(0)
    );

    return new TextDecoder().decode(bytes);
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

        // Home
        if (url.pathname === "/") {
            return new Response(
                "GGDL Admin Worker is running."
            );
        }

        // Test GitHub connection
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

        // Get the level list
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

            const listText = decodeBase64(
                file.content
            );

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

        // Get one level
        if (url.pathname === "/get-level") {
            if (request.method !== "GET") {
                return json(
                    {
                        ok: false,
                        error: "Use GET for /get-level.",
                    },
                    405
                );
            }

            const path = url.searchParams.get("path");

            if (!path) {
                return json(
                    {
                        ok: false,
                        error: "Missing level path.",
                    },
                    400
                );
            }

            const response = await githubRequest(
                `/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
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

            const levelText = decodeBase64(
                file.content
            );

            const level = JSON.parse(levelText);

            return json({
                ok: true,
                file: file.path,
                sha: file.sha,
                level,
            });
        }

        // Update an existing level
        if (url.pathname === "/update-level") {
            if (request.method !== "POST") {
                return json(
                    {
                        ok: false,
                        error: "Use POST for /update-level.",
                    },
                    405
                );
            }

            let body;

            try {
                body = await request.json();
            } catch {
                return json(
                    {
                        ok: false,
                        error: "Invalid JSON body.",
                    },
                    400
                );
            }

            const path = body.path;
            const level = body.level;

            if (!path) {
                return json(
                    {
                        ok: false,
                        error: "Missing 'path'.",
                    },
                    400
                );
            }

            if (!level) {
                return json(
                    {
                        ok: false,
                        error: "Missing 'level'.",
                    },
                    400
                );
            }

            // Get the current file first.
            // GitHub requires its current SHA to update it.
            const existingResponse = await githubRequest(
                `/repos/${REPO}/contents/${path}?ref=${BRANCH}`,
                env
            );

            const existingText =
                await existingResponse.text();

            if (!existingResponse.ok) {
                return json(
                    {
                        ok: false,
                        status: existingResponse.status,
                        error: "Could not find existing level file.",
                        githubResponse: existingText,
                    },
                    502
                );
            }

            const existingFile =
                JSON.parse(existingText);

            // Convert updated level JSON to Base64
            const content = encodeBase64(
                JSON.stringify(level, null, 2) + "\n"
            );

            // Send updated file to GitHub
            const updateResponse = await githubRequest(
                `/repos/${REPO}/contents/${path}`,
                env,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        message: `Admin Worker: update ${path}`,
                        content,
                        sha: existingFile.sha,
                        branch: BRANCH,
                    }),
                }
            );

            const updateText =
                await updateResponse.text();

            if (!updateResponse.ok) {
                return json(
                    {
                        ok: false,
                        status: updateResponse.status,
                        githubResponse: updateText,
                    },
                    502
                );
            }

            const result =
                JSON.parse(updateText);

            return json({
                ok: true,
                message: "Level successfully updated.",
                branch: BRANCH,
                file: result.content?.path,
                sha: result.content?.sha,
                commit: result.commit?.sha,
            });
        }

        // Test write
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

            const content = encodeBase64(
                JSON.stringify(testData, null, 4) + "\n"
            );

            const filePath =
                `/repos/${REPO}/contents/data/_admin-test.json`;

            let existingSha;

            const existingResponse =
                await githubRequest(
                    `${filePath}?ref=${BRANCH}`,
                    env
                );

            if (existingResponse.ok) {
                const existingFile =
                    await existingResponse.json();

                existingSha = existingFile.sha;
            } else if (
                existingResponse.status !== 404
            ) {
                const text =
                    await existingResponse.text();

                return json(
                    {
                        ok: false,
                        status: existingResponse.status,
                        githubResponse: text,
                    },
                    502
                );
            }

            const response =
                await githubRequest(
                    filePath,
                    env,
                    {
                        method: "PUT",
                        body: JSON.stringify({
                            message:
                                "Admin Worker: test write",
                            content,
                            branch: BRANCH,
                            ...(existingSha
                                ? { sha: existingSha }
                                : {}),
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
                message:
                    "Test file successfully written to the test branch.",
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