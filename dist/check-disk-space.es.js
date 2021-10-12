import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { normalize, sep } from 'path';

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

class InvalidPathError extends Error {
    constructor(message) {
        super(message);
        this.name = 'InvalidPathError';
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, InvalidPathError.prototype);
    }
}

class NoMatchError extends Error {
    constructor(message) {
        super(message);
        this.name = 'NoMatchError';
        // Set the prototype explicitly.
        Object.setPrototypeOf(this, NoMatchError.prototype);
    }
}

/**
 * Get the first existing parent path
 *
 * @param directoryPath - The file/folder path from where we want to know disk space
 * @param dependencies - Dependencies container
 */
function getFirstExistingParentPath(directoryPath, dependencies) {
    let parentDirectoryPath = directoryPath;
    let parentDirectoryFound = dependencies.fsExistsSync(parentDirectoryPath);
    while (!parentDirectoryFound) {
        parentDirectoryPath = dependencies.pathNormalize(parentDirectoryPath + '/..');
        parentDirectoryFound = dependencies.fsExistsSync(parentDirectoryPath);
    }
    return parentDirectoryPath;
}

/**
 * Check disk space
 *
 * @param directoryPath - The file/folder path from where we want to know disk space
 * @param dependencies - Dependencies container
 */
function checkDiskSpace(directoryPath, dependencies = {
    platform: process.platform,
    fsExistsSync: existsSync,
    pathNormalize: normalize,
    pathSep: sep,
    cpExecFile: execFile,
}) {
    /**
     * Maps command output to a normalized object {diskPath, free, size}
     *
     * @param stdout - The command output
     * @param filter - To filter drives (only used for win32)
     * @param mapping - Map between column index and normalized column name
     * @param coefficient - The size coefficient to get bytes instead of kB
     */
    function mapOutput(stdout, filter, mapping, coefficient) {
        const parsed = stdout.trim().split('\n').slice(1).map(line => {
            return line.trim().split(/\s+(?=[\d/])/);
        });
        const filtered = parsed.filter(filter);
        if (filtered.length === 0) {
            throw new NoMatchError();
        }
        const diskData = filtered[0];
        return {
            diskPath: diskData[mapping.diskPath],
            free: parseInt(diskData[mapping.free], 10) * coefficient,
            size: parseInt(diskData[mapping.size], 10) * coefficient,
        };
    }
    /**
     * Run the command and do common things between win32 and unix
     *
     * @param cmd - The command to execute
     * @param filter - To filter drives (only used for win32)
     * @param mapping - Map between column index and normalized column name
     * @param coefficient - The size coefficient to get bytes instead of kB
     */
    function check(cmd, filter, mapping, coefficient = 1) {
        return new Promise((resolve, reject) => {
            const [file, ...args] = cmd;
            /* istanbul ignore if */
            if (file === undefined) {
                return Promise.reject('cmd must contain at least one item');
            }
            const options = dependencies.platform === 'win32' ? {
                env: Object.assign(Object.assign({}, process.env), { PATH: `${process.env.SystemRoot}\\System32\\Wbem;${process.env.PATH}` }),
            } : null;
            dependencies.cpExecFile(file, args, options, (error, stdout) => {
                if (error) {
                    reject(error);
                }
                try {
                    resolve(mapOutput(stdout, filter, mapping, coefficient));
                }
                catch (error2) {
                    reject(error2);
                }
            });
        });
    }
    /**
     * Build the check call for win32
     *
     * @param directoryPath - The file/folder path from where we want to know disk space
     */
    function checkWin32(directoryPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (directoryPath.charAt(1) !== ':') {
                return new Promise((resolve, reject) => {
                    reject(new InvalidPathError(`The following path is invalid (should be X:\\...): ${directoryPath}`));
                });
            }
            return check(['wmic', 'logicaldisk', 'get', 'size,freespace,caption'], driveData => {
                // Only get the drive which match the path
                const driveLetter = driveData[0];
                return directoryPath.toUpperCase().startsWith(driveLetter.toUpperCase());
            }, {
                diskPath: 0,
                free: 1,
                size: 2,
            });
        });
    }
    /**
     * Build the check call for unix
     *
     * @param directoryPath - The file/folder path from where we want to know disk space
     */
    function checkUnix(directoryPath) {
        if (!dependencies.pathNormalize(directoryPath).startsWith(dependencies.pathSep)) {
            return new Promise((resolve, reject) => {
                reject(new InvalidPathError(`The following path is invalid (should start by ${dependencies.pathSep}): ${directoryPath}`));
            });
        }
        const pathToCheck = getFirstExistingParentPath(directoryPath, dependencies);
        return check(['df', '-Pk', '--', pathToCheck], () => true, // We should only get one line, so we did not need to filter
        {
            diskPath: 5,
            free: 3,
            size: 1,
        }, 1024);
    }
    // Call the right check depending on the OS
    if (dependencies.platform === 'win32') {
        return checkWin32(directoryPath);
    }
    return checkUnix(directoryPath);
}

export default checkDiskSpace;
export { InvalidPathError, NoMatchError, getFirstExistingParentPath };
