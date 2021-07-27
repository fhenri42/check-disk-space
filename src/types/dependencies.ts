import {ChildProcess, ExecFileException, ExecFileOptions} from 'child_process'
import {existsSync} from 'fs'
import {normalize, sep} from 'path'

export type CpExecFileCallback = (error: ExecFileException | null, stdout: string, stderr: string) => void;

interface CpExecFile {
	(file: string, args: ReadonlyArray<string> | undefined | null, callback: CpExecFileCallback): ChildProcess
	(file: string, args: ReadonlyArray<string> | undefined | null, options: ExecFileOptions | undefined | null, callback: CpExecFileCallback): ChildProcess
}

type Dependencies = {
	platform: NodeJS.Platform
	fsExistsSync: typeof existsSync
	pathNormalize: typeof normalize
	pathSep: typeof sep
	cpExecFile: CpExecFile
}

export default Dependencies
