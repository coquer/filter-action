const core = require('@actions/core');
const fs = require('node:fs');
const {Octokit} = require('@octokit/rest');
const {HttpsProxyAgent} = require('https-proxy-agent');

const GH_API_URL = 'https://api.github.com';

async function run() {
  const inputs = {
    token: core.getInput('token') || process.env.GITHUB_TOKEN,
    list: core.getInput('list') || process.env.MATRIX_LIST,
    ref: core.getInput('ref') || process.env.GITHUB_REF_NAME,
    repository: core.getInput('repository') || process.env.GITHUB_REPOSITORY,
  }

  core.info('list: ' + inputs.list);
  core.info('ref: ' + inputs.ref);
  core.info('repository: ' + inputs.repository);

  if (!inputs.token) {
    core.setFailed('No token provided');
    return;
  }

  if (!inputs.list) {
    core.setFailed('No list provided');
    return;
  }

  const content = await fs.promises.readFile(inputs.list, 'utf8')

  if (!content) {
    core.setFailed('No content in the list');
    return;
  }

  // noinspection JSCheckFunctionSignatures
  const list = JSON.parse(content);

  if (!list) {
    core.setFailed('Invalid list');
    return;
  }

  const octokit = new Octokit({
    auth: inputs.token,
    baseUrl: GH_API_URL,
    request: {
      agent: new HttpsProxyAgent(GH_API_URL),
    }
  });

  const repository = process.env.GITHUB_REPOSITORY.split('/');

  if (repository.length !== 2) {
    core.setFailed('Invalid repository');
    return;
  }

  const owner = repository[0];
  const repo = repository[1];

  const response = await octokit.repos.compareCommitsWithBasehead({
    owner,
    repo,
    basehead: await getBaseHead(octokit, owner, repo, inputs.ref)
  });

  const files = response.data.files;

  if (!files) {
    core.info('No files changed in the commit');
    core.setOutput('filtered', '');
    return;
  }

  const resultFileChanges = files.map((file) => file.filename);
  const filtered = resultFileChanges.filter((item, index) => resultFileChanges.indexOf(item) === index).map((file) => file.substr(0, file.indexOf('/')))
      .filter((item, index) => item.indexOf('/') === -1 && item.length > 0);
  const uniqueDirs = filtered.filter((item, index) => filtered.indexOf(item) === index);

  const filteredMatrix = list.filter(({service}) => uniqueDirs.includes(service));

  if (!filteredMatrix) {
    core.info('No services found in the list');
    core.setOutput('filtered', '');
    return;
  }

  core.setOutput('filtered', JSON.stringify(filteredMatrix));
}

async function getBaseHead(octokit, owner, repo, ref) {
  const defaultBranch = await getDefaultBranch(octokit, owner, repo);
  const lastTag = await getLastTag(octokit, owner, repo);

  core.info('defaultBranch: ' + defaultBranch);
  core.info('lastTag: ' + lastTag);

  if (ref === defaultBranch) {
    core.info('diff: ' + `${lastTag}...${defaultBranch}`);
    return `${lastTag}...${defaultBranch}`;
  }

  if (lastTag === '') {
    const firstCommit = await getFirstCommit(octokit, owner, repo);
    core.info('diff: ' + `${firstCommit}...${ref}`)
    return `${firstCommit}...${ref}`;
  }

  const refParts = ref.split('/');

  if (refParts.length === 2) {
    const prNumber = refParts[0];
    const merge = refParts[1];

    if (isNaN(prNumber) || merge !== 'merge') {
      core.setFailed('Invalid pull request reference');
      return;
    }

    const {data} = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber
    });

    core.info('diff: ' + `${lastTag}...${data.head.sha}`);

    return `${lastTag}...${data.head.sha}`;
  }

  // by now we know that ref is a branch, so we can use it directly.
  core.info('diff: ' + `${lastTag}...${ref}`);

  return `${lastTag}...${ref}`;
}

async function getDefaultBranch(octokit, owner, repo) {
  const {data} = await octokit.repos.get({
    owner,
    repo
  });

  return data.default_branch;
}

async function getLastTag(octokit, owner, repo) {
  const {data} = await octokit.repos.listTags({
    owner,
    repo
  });

  if (data.length === 0) {
    return '';
  }

  return data[0].name;
}

async function getFirstCommit(octokit, owner, repo) {
  const {data} = await octokit.repos.listCommits({
    owner,
    repo
  });

  if (data.length === 0) {
    return '';
  }

  return data[0].sha;
}

run().catch((error) => {
  core.setFailed(error.message);
});

