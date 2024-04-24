import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from "node:fs";

async function run() {
	const jsonPath = core.getInput('list')
	const diffBranch = core.getInput('diffBranch')

	const content = await fs.promises.readFile(jsonPath, 'utf8')
	const list = JSON.parse(content)

	if (list.length === 0) {
		core.error('No files to check')
		return
	}

	let diff = ''
	const command = `git diff --name-only ${{diffBranch}} | cut -d / -f 1 | uniq | grep -v "\\."`
	try {
		diff = await execHelper('bash', ['-c', command])
	} catch (error) {
		// @ts-ignore
		core.error(error)
	}

	const splitString = diff.split('\n')

	if (splitString.length === 0) {
		core.info('No files to check')
		return
	}

	const filteredList = list.filter(({service}: any) => {
		// @ts-ignore
		return splitString.includes(service)
	})

	if (filteredList.length === 0) {
		core.info('No files to check')
		return
	}

	const filteredListString = JSON.stringify(filteredList)

	core.setOutput('filtered', filteredListString)
}


const execHelper = async (tool, args: string[], options: exec.ExecOptions = {}) => {
	let stdout = ""
	let stderr = ""

	const opts = {
		...options,
		listeners: {
			stdout: (data) => {
				stdout += data.toString()
			},
			stderr: (data) => {
				stderr += data.toString()
			}
		}
	}

	const exitCode = await exec.exec(tool, args, opts)
	if (exitCode != 0) {
		const errMsg = `${tool} exited with code: ${exitCode} \n ${stderr}`
		throw Error(errMsg)
	}

	return stdout
}

run().catch(core.setFailed)
