// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ScaleCodec - SCALE encoding library for Polkadot XCM integration
/// @notice Implements Substrate's SCALE codec in pure Solidity for encoding
///         XCM messages, pallet calls, and cross-chain operations.
/// @dev SCALE uses little-endian byte ordering for all integer types.
///      Reference: https://docs.substrate.io/reference/scale-codec/
library ScaleCodec {
    // ============================================================
    //                    COMPACT ENCODING
    // ============================================================

    /// @notice Encode a uint32 as SCALE compact integer
    /// @dev Variable-length representation:
    ///      0-63:          1 byte,  val << 2 | 0b00
    ///      64-16383:      2 bytes, val << 2 | 0b01 (little-endian)
    ///      16384-2^30-1:  4 bytes, val << 2 | 0b10 (little-endian)
    function encodeCompactU32(uint32 value) internal pure returns (bytes memory) {
        if (value <= 63) {
            return abi.encodePacked(uint8(value << 2));
        } else if (value <= 16383) {
            uint16 encoded = uint16(value << 2) | 0x01;
            return abi.encodePacked(uint8(encoded & 0xFF), uint8(encoded >> 8));
        } else {
            uint32 encoded = (value << 2) | 0x02;
            return abi.encodePacked(
                uint8(encoded & 0xFF),
                uint8((encoded >> 8) & 0xFF),
                uint8((encoded >> 16) & 0xFF),
                uint8((encoded >> 24) & 0xFF)
            );
        }
    }

    /// @notice Encode a uint64 as SCALE compact integer
    /// @dev Used for XCM Weight fields (refTime, proofSize)
    function encodeCompactU64(uint64 value) internal pure returns (bytes memory) {
        if (value <= 63) {
            return abi.encodePacked(uint8(uint8(value) << 2));
        } else if (value <= 16383) {
            uint16 encoded = uint16(value << 2) | 0x01;
            return abi.encodePacked(uint8(encoded & 0xFF), uint8(encoded >> 8));
        } else if (value <= 1073741823) {
            uint32 encoded = uint32(value << 2) | 0x02;
            return abi.encodePacked(
                uint8(encoded & 0xFF),
                uint8((encoded >> 8) & 0xFF),
                uint8((encoded >> 16) & 0xFF),
                uint8((encoded >> 24) & 0xFF)
            );
        } else {
            uint8 bytesNeeded = 0;
            uint64 temp = value;
            while (temp > 0) {
                bytesNeeded++;
                temp >>= 8;
            }
            bytes memory result = new bytes(1 + bytesNeeded);
            result[0] = bytes1(uint8(((bytesNeeded - 4) << 2) | 0x03));
            for (uint8 i = 0; i < bytesNeeded; i++) {
                result[1 + i] = bytes1(uint8(value >> (i * 8)));
            }
            return result;
        }
    }

    /// @notice Encode a uint128 as SCALE compact integer
    /// @dev Used for DOT balance amounts in XCM asset fields
    function encodeCompactU128(uint128 value) internal pure returns (bytes memory) {
        if (value <= 63) {
            return abi.encodePacked(uint8(uint8(value) << 2));
        } else if (value <= 16383) {
            uint16 encoded = uint16(value << 2) | 0x01;
            return abi.encodePacked(uint8(encoded & 0xFF), uint8(encoded >> 8));
        } else if (value <= 1073741823) {
            uint32 encoded = uint32(value << 2) | 0x02;
            return abi.encodePacked(
                uint8(encoded & 0xFF),
                uint8((encoded >> 8) & 0xFF),
                uint8((encoded >> 16) & 0xFF),
                uint8((encoded >> 24) & 0xFF)
            );
        } else {
            uint8 bytesNeeded = 0;
            uint128 temp = value;
            while (temp > 0) {
                bytesNeeded++;
                temp >>= 8;
            }
            bytes memory result = new bytes(1 + bytesNeeded);
            result[0] = bytes1(uint8(((bytesNeeded - 4) << 2) | 0x03));
            for (uint8 i = 0; i < bytesNeeded; i++) {
                result[1 + i] = bytes1(uint8(uint256(value) >> (i * 8)));
            }
            return result;
        }
    }

    // ============================================================
    //                    FIXED-WIDTH ENCODING
    // ============================================================

    /// @notice Encode a uint128 as 16 bytes little-endian (fixed-width)
    /// @dev Used for balance fields that are NOT compact-encoded (e.g. AccountVote)
    function encodeU128LE(uint128 value) internal pure returns (bytes memory) {
        bytes memory result = new bytes(16);
        for (uint8 i = 0; i < 16; i++) {
            result[i] = bytes1(uint8(uint256(value) >> (i * 8)));
        }
        return result;
    }

    /// @notice Encode a uint64 as 8 bytes little-endian (fixed-width)
    /// @dev Used for Weight struct fields (ref_time, proof_size)
    function encodeU64LE(uint64 value) internal pure returns (bytes memory) {
        bytes memory result = new bytes(8);
        for (uint8 i = 0; i < 8; i++) {
            result[i] = bytes1(uint8(value >> (i * 8)));
        }
        return result;
    }

    // ============================================================
    //                    VECTOR ENCODING
    // ============================================================

    /// @notice Encode a bytes array as SCALE Vec<u8> (compact length prefix + data)
    function encodeVecU8(bytes memory data) internal pure returns (bytes memory) {
        bytes memory lengthPrefix = encodeCompactU32(uint32(data.length));
        return abi.encodePacked(lengthPrefix, data);
    }
}
