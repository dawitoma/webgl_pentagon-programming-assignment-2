/**
 * WebGL Pentagon Rendering Program
 * 
 * This program renders a 5-vertex pentagon with a blue surface that rotates slowly
 * around both the x and y axes. It includes interactive controls for pausing/resuming
 * rotation, changing color, resetting the view, and sharing the project via URLs.
 * 
 * The implementation uses pure WebGL without external libraries, with custom matrix
 * operations for transformations and perspective projection.
 */

// Matrix operations for WebGL
const mat4 = {
    /**
     * Creates a new 4x4 identity matrix
     * @returns {Float32Array} Identity matrix
     */
    create: function() {
        return new Float32Array([
            1, 0, 0, 0,
            0, 1, 0, 0,
            0, 0, 1, 0,
            0, 0, 0, 1
        ]);
    },
    
    /**
     * Creates a perspective projection matrix
     * @param {Float32Array} out - Output matrix
     * @param {number} fovy - Field of view in radians
     * @param {number} aspect - Aspect ratio (width/height)
     * @param {number} near - Near clipping plane
     * @param {number} far - Far clipping plane
     * @returns {Float32Array} Perspective projection matrix
     */
    perspective: function(out, fovy, aspect, near, far) {
        const f = 1.0 / Math.tan(fovy / 2);
        out[0] = f / aspect;
        out[1] = 0;
        out[2] = 0;
        out[3] = 0;
        out[4] = 0;
        out[5] = f;
        out[6] = 0;
        out[7] = 0;
        out[8] = 0;
        out[9] = 0;
        out[10] = (far + near) / (near - far);
        out[11] = -1;
        out[12] = 0;
        out[13] = 0;
        out[14] = (2 * far * near) / (near - far);
        out[15] = 0;
        return out;
    },
    
    /**
     * Translates a matrix by a vector
     * @param {Float32Array} out - Output matrix
     * @param {Float32Array} a - Matrix to translate
     * @param {number[]} v - Translation vector [x, y, z]
     * @returns {Float32Array} Translated matrix
     */
    translate: function(out, a, v) {
        const x = v[0], y = v[1], z = v[2];
        
        out[0] = a[0]; out[1] = a[1]; out[2] = a[2]; out[3] = a[3];
        out[4] = a[4]; out[5] = a[5]; out[6] = a[6]; out[7] = a[7];
        out[8] = a[8]; out[9] = a[9]; out[10] = a[10]; out[11] = a[11];
        
        out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
        out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
        out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
        out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
        
        return out;
    },
    
    /**
     * Rotates a matrix around an axis
     * @param {Float32Array} out - Output matrix
     * @param {Float32Array} a - Matrix to rotate
     * @param {number} rad - Rotation angle in radians
     * @param {number[]} axis - Rotation axis [x, y, z]
     * @returns {Float32Array} Rotated matrix
     */
    rotate: function(out, a, rad, axis) {
        let x = axis[0], y = axis[1], z = axis[2];
        let len = Math.sqrt(x * x + y * y + z * z);
        
        if (len < 0.000001) return null;
        
        len = 1 / len;
        x *= len;
        y *= len;
        z *= len;
        
        const s = Math.sin(rad);
        const c = Math.cos(rad);
        const t = 1 - c;
        
        const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
        const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
        const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
        
        // Construct the rotation matrix
        const b00 = x * x * t + c;
        const b01 = y * x * t + z * s;
        const b02 = z * x * t - y * s;
        const b10 = x * y * t - z * s;
        const b11 = y * y * t + c;
        const b12 = z * y * t + x * s;
        const b20 = x * z * t + y * s;
        const b21 = y * z * t - x * s;
        const b22 = z * z * t + c;
        
        // Perform rotation-specific matrix multiplication
        out[0] = a00 * b00 + a10 * b01 + a20 * b02;
        out[1] = a01 * b00 + a11 * b01 + a21 * b02;
        out[2] = a02 * b00 + a12 * b01 + a22 * b02;
        out[3] = a03 * b00 + a13 * b01 + a23 * b02;
        out[4] = a00 * b10 + a10 * b11 + a20 * b12;
        out[5] = a01 * b10 + a11 * b11 + a21 * b12;
        out[6] = a02 * b10 + a12 * b11 + a22 * b12;
        out[7] = a03 * b10 + a13 * b11 + a23 * b12;
        out[8] = a00 * b20 + a10 * b21 + a20 * b22;
        out[9] = a01 * b20 + a11 * b21 + a21 * b22;
        out[10] = a02 * b20 + a12 * b21 + a22 * b22;
        out[11] = a03 * b20 + a13 * b21 + a23 * b22;
        
        // If the source and destination differ, copy the unchanged last row
        if (a !== out) {
            out[12] = a[12];
            out[13] = a[13];
            out[14] = a[14];
            out[15] = a[15];
        }
        
        return out;
    }
};

// Main WebGL program
function main() {
    // Get WebGL context
    const canvas = document.getElementById('glCanvas');
    const gl = canvas.getContext('webgl');
    
    if (!gl) {
        alert('Unable to initialize WebGL. Your browser may not support it.');
        return;
    }
    
    // Vertex shader source code - transforms vertex positions
    const vsSource = `
        attribute vec4 aVertexPosition;
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        
        void main() {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
        }
    `;
    
    // Fragment shader source code - sets fragment color
    const fsSource = `
        precision mediump float;
        uniform vec4 uColor;
        
        void main() {
            gl_FragColor = uColor;
        }
    `;
    
    // Initialize shaders
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    
    // Collect all the info needed to use the shader program
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            color: gl.getUniformLocation(shaderProgram, 'uColor'),
        },
    };
    
    // Build the pentagon geometry
    const buffers = initBuffers(gl);
    
    // Set initial color to blue (RGBA format)
    let color = [0.2, 0.4, 0.8, 1.0];
    
    // Rotation state variables
    let rotationX = 0;
    let rotationY = 0;
    let rotationSpeedX = 0.01;
    let rotationSpeedY = 0.005;
    let isRotating = true;
    
    /**
     * Rendering function - called recursively to animate the scene
     */
    function render() {
        drawScene(gl, programInfo, buffers, color, rotationX, rotationY);
        
        // Update rotation angles if rotating
        if (isRotating) {
            rotationX += rotationSpeedX;
            rotationY += rotationSpeedY;
        }
        
        // Request next frame
        requestAnimationFrame(render);
    }
    
    // Start rendering
    render();
    
    // Event listeners for UI controls
    
    // Toggle rotation pause/resume
    document.getElementById('toggleRotation').addEventListener('click', function() {
        isRotating = !isRotating;
        this.textContent = isRotating ? 'Pause Rotation' : 'Resume Rotation';
    });
    
    // Toggle between blue and red colors
    document.getElementById('changeColor').addEventListener('click', function() {
        if (color[0] === 0.2 && color[1] === 0.4 && color[2] === 0.8) {
            color = [0.8, 0.2, 0.2, 1.0]; // Red
        } else {
            color = [0.2, 0.4, 0.8, 1.0]; // Blue
        }
    });
    
    // Reset rotation angles to zero
    document.getElementById('resetView').addEventListener('click', function() {
        rotationX = 0;
        rotationY = 0;
    });
    
    // Show/hide share section with URLs
    document.getElementById('shareButton').addEventListener('click', function() {
        const shareSection = document.getElementById('shareSection');
        shareSection.style.display = shareSection.style.display === 'none' ? 'block' : 'none';
        
        // Generate URLs (in a real scenario, these would be actual URLs)
        document.getElementById('graphicsUrl').textContent = window.location.href + '#graphics-view';
        document.getElementById('codeUrl').textContent = window.location.href + '#code-view';
    });
}

/**
 * Initializes a shader program
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {string} vsSource - Vertex shader source code
 * @param {string} fsSource - Fragment shader source code
 * @returns {WebGLProgram} Compiled shader program
 */
function initShaderProgram(gl, vsSource, fsSource) {
    // Create shaders
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    
    // Create shader program
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    
    // Check if successful
    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
    }
    
    return shaderProgram;
}

/**
 * Creates a shader of the given type, uploads the source and compiles it
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {number} type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
 * @param {string} source - Shader source code
 * @returns {WebGLShader} Compiled shader
 */
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    
    // Send source to shader object
    gl.shaderSource(shader, source);
    
    // Compile shader
    gl.compileShader(shader);
    
    // Check if compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    
    return shader;
}

/**
 * Initializes buffers for the pentagon geometry
 * @param {WebGLRenderingContext} gl - WebGL context
 * @returns {Object} Buffer objects containing position data and vertex count
 */
function initBuffers(gl) {
    // Create a buffer for the pentagon's vertex positions
    const positionBuffer = gl.createBuffer();
    
    // Select the positionBuffer as the one to apply buffer operations to
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    // Define the vertices for a pentagon using trigonometry
    const vertices = [];
    const radius = 0.8;
    const centerX = 0;
    const centerY = 0;
    
    // Calculate vertices using trigonometry (5 points equally spaced around a circle)
    for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - (Math.PI / 2); // Start from top
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        vertices.push(x, y, 0); // Z is 0 for 2D shape
    }
    
    // Pass the list of vertices to WebGL
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    
    return {
        position: positionBuffer,
        vertexCount: 5
    };
}

/**
 * Draws the scene with the current state
 * @param {WebGLRenderingContext} gl - WebGL context
 * @param {Object} programInfo - Shader program information
 * @param {Object} buffers - Geometry buffers
 * @param {number[]} color - RGBA color values
 * @param {number} rotationX - Rotation around X axis
 * @param {number} rotationY - Rotation around Y axis
 */
function drawScene(gl, programInfo, buffers, color, rotationX, rotationY) {
    // Set clear color to dark gray and clear the buffer
    gl.clearColor(0.1, 0.1, 0.1, 1.0);
    gl.clearDepth(1.0); // Clear everything
    gl.enable(gl.DEPTH_TEST); // Enable depth testing
    gl.depthFunc(gl.LEQUAL); // Near things obscure far things
    
    // Clear the canvas
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Create a perspective matrix
    const fieldOfView = 45 * Math.PI / 180; // in radians
    const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const zNear = 0.1;
    const zFar = 100.0;
    const projectionMatrix = mat4.create();
    
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
    
    // Set the drawing position to the "identity" point which is at the center of the scene
    const modelViewMatrix = mat4.create();
    
    // Move the drawing position a bit to where we want to start drawing
    mat4.translate(modelViewMatrix, modelViewMatrix, [0.0, 0.0, -3.0]);
    
    // Apply rotation
    mat4.rotate(modelViewMatrix, modelViewMatrix, rotationX, [1, 0, 0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, rotationY, [0, 1, 0]);
    
    // Tell WebGL how to pull out the positions from the position buffer into the vertexPosition attribute
    {
        const numComponents = 3; // (x, y, z)
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(
            programInfo.attribLocations.vertexPosition,
            numComponents,
            type,
            normalize,
            stride,
            offset);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);
    }
    
    // Tell WebGL to use our program when drawing
    gl.useProgram(programInfo.program);
    
    // Set the shader uniforms
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.projectionMatrix,
        false,
        projectionMatrix);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.modelViewMatrix,
        false,
        modelViewMatrix);
    gl.uniform4fv(programInfo.uniformLocations.color, color);
    
    // Draw the pentagon as a triangle fan (connects all vertices to form a filled polygon)
    gl.drawArrays(gl.TRIANGLE_FAN, 0, buffers.vertexCount);
}

/**
 * Copies URL to clipboard
 * @param {string} elementId - ID of the element containing the URL text
 */
function copyUrl(elementId) {
    const text = document.getElementById(elementId).textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert('URL copied to clipboard!');
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}

// Start the WebGL program when the page is fully loaded
window.onload = main;