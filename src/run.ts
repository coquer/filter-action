import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from "node:fs";

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
	await exec.exec(`git diff --name-only ${diffBranch}..${currentBranch} | cut -d / -f 1 | uniq | grep -v "\\."`, [], {
		listeners: {
			stdout: (data: Buffer) => {
				let value = data.toString()
				let values = value.split('\n')
				if (values.length > 0) {
					// @ts-ignore
					diff.push(values)
				}
			},
		},
	})

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
