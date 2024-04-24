import * as core from '@actions/core'
import * as fs from "node:fs";
import { exec as childExec } from 'child_process';

async function run() {
	const jsonPath = core.getInput('list')
	const diffBranch = core.getInput('diffBranch')
	const currentBranch = core.getInput('currentBranch')

	const content = await fs.promises.readFile(jsonPath, 'utf8')
	const list = JSON.parse(content)

	if (list.length === 0) {
		core.error('No files to check')
		return
	}

	let diff = []
	childExec(`git diff --name-only master | cut -d / -f 1 | uniq | grep -v "\\."`, (error, stdout, stderr) => {
		if (error) {
			core.setFailed(`exec error: ${error}`);
			return;
		}

		core.info(`stdout: ${stdout}`);
		let values = stdout.split('\n');
		if (values.length > 0) {
			// @ts-ignore
			diff.push(values);
		}
	});

	if (diff.length === 0) {
		core.info('No files to check')
		return
	}

	const filteredList = list.filter(({service}: any) => {
		// @ts-ignore
		return diff.includes(service)
	})

	if (filteredList.length === 0) {
		core.info('No files to check')
		return
	}

	const filteredListString = JSON.stringify(filteredList)

	core.setOutput('filtered', filteredListString)
}

run().catch(core.setFailed)
