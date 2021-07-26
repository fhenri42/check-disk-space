import {ChildProcess, ExecFileOptions} from 'child_process'
import {EventEmitter} from 'events'
import {normalize} from 'path'

import Dependencies, { CpExecFileCallback } from '@/src/types/dependencies'

function mockDependencies(overrides?: Partial<Dependencies>, options?: {
	cpExecFileOutput?: string
	cpExecFileError?: Error
}): Dependencies {
	function cpExecFile(cmd: string, args: ReadonlyArray<string> | undefined | null, option: ExecFileOptions | undefined | null, callback: CpExecFileCallback): ChildProcess;
	function cpExecFile(cmd: string, args: ReadonlyArray<string> | undefined | null, callback: CpExecFileCallback): ChildProcess;
	function cpExecFile(cmd: string, args: ReadonlyArray<string> | undefined | null, option: ExecFileOptions | CpExecFileCallback | undefined | null, possiblyCallback?: CpExecFileCallback) {
		const callback = typeof option === 'function' ? option : possiblyCallback

		if (callback) {
			process.nextTick(() => {
				if (options?.cpExecFileError !== undefined) {
					callback(options.cpExecFileError, '', '')
				}

				callback(null, options?.cpExecFileOutput ?? '', '')
			})
		}
		return new EventEmitter() as ChildProcess
	}

	const dependencies: Dependencies = {
		platform: 'linux',
		fsExistsSync: () => true,
		pathNormalize: normalize,
		pathSep: '/',
		cpExecFile,
		...overrides,
	}

	return dependencies
}

export default mockDependencies
